mod document_parser;
mod system_db;

use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use actix_multipart::Multipart;
use futures_util::StreamExt;
use keradb::{Database, VectorConfig, Distance};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use system_db::SystemDatabase;

// App state
struct AppState {
    databases: Arc<RwLock<HashMap<String, Arc<Database>>>>,
    system_db: Arc<SystemDatabase>,
}

// Request/Response types
#[derive(Serialize, Deserialize)]
struct OpenDatabaseRequest {
    path: String,
}

#[derive(Serialize, Deserialize)]
struct DatabaseInfo {
    path: String,
    collections: Vec<CollectionInfo>,
}

#[derive(Serialize, Deserialize)]
struct CollectionInfo {
    name: String,
    count: usize,
}

#[derive(Serialize, Deserialize)]
struct InsertRequest {
    collection: String,
    document: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct UpdateRequest {
    collection: String,
    id: String,
    document: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct DeleteRequest {
    collection: String,
    id: String,
}

#[derive(Serialize, Deserialize)]
struct DropCollectionRequest {
    collection: String,
}

#[derive(Serialize, Deserialize)]
struct CloseDatabaseRequest {
    path: String,
}

// Vector-related request/response types
#[derive(Serialize, Deserialize)]
struct CreateVectorCollectionRequest {
    name: String,
    dimensions: usize,
    #[serde(default = "default_distance")]
    distance: String,
    #[serde(default = "default_m")]
    m: usize,
    #[serde(default = "default_ef")]
    ef_construction: usize,
}

fn default_distance() -> String { "cosine".to_string() }
fn default_m() -> usize { 16 }
fn default_ef() -> usize { 200 }

#[derive(Serialize, Deserialize)]
struct InsertVectorRequest {
    collection: String,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct VectorSearchRequest {
    collection: String,
    vector: Vec<f32>,
    k: usize,
}

#[derive(Serialize, Deserialize)]
struct DeleteVectorRequest {
    collection: String,
    id: u64,
}

#[derive(Serialize, Deserialize)]
struct VectorCollectionInfoResponse {
    name: String,
    count: usize,
    dimensions: usize,
    distance: String,
}

#[derive(Serialize, Deserialize)]
struct VectorSearchResultResponse {
    id: u64,
    score: f32,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct VectorDocumentResponse {
    id: u64,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
    created_at: u64,
}

#[derive(Serialize, Deserialize)]
struct GetAllVectorsRequest {
    collection: String,
    limit: Option<usize>,
    skip: Option<usize>,
}

#[derive(Serialize, Deserialize)]
struct QueryRequest {
    collection: String,
    limit: Option<usize>,
    skip: Option<usize>,
}

// API Handlers

async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "keradb-labs",
        "version": env!("CARGO_PKG_VERSION")
    })))
}

// Convert Windows path to WSL path if needed
fn normalize_path(path: &str) -> String {
    // Check if it's a Windows-style path (e.g., D:\path or D:/path)
    if let Some(drive_and_rest) = path.strip_prefix(|c: char| c.is_ascii_alphabetic()) {
        if let Some(rest) = drive_and_rest.strip_prefix(":\\") {
            // Convert D:\path to /mnt/d/path
            let drive = path.chars().next().unwrap().to_lowercase();
            let wsl_path = format!("/mnt/{}/{}", drive, rest.replace('\\', "/"));
            return wsl_path;
        } else if let Some(rest) = drive_and_rest.strip_prefix(":/") {
            // Convert D:/path to /mnt/d/path
            let drive = path.chars().next().unwrap().to_lowercase();
            let wsl_path = format!("/mnt/{}/{}", drive, rest);
            return wsl_path;
        }
    }
    // Return as-is if not a Windows path
    path.to_string()
}

async fn open_database(
    data: web::Data<AppState>,
    req: web::Json<OpenDatabaseRequest>,
) -> Result<HttpResponse> {
    let db_path = normalize_path(&req.path);
    let start = std::time::Instant::now();
    
    log::info!("Opening database: {} (original: {})", db_path, req.path);
    
    // Open or create database
    let db = match Database::open(&db_path) {
        Ok(db) => db,
        Err(_) => Database::create(&db_path)
            .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?,
    };

    let collections: Vec<CollectionInfo> = db
        .list_collections()
        .into_iter()
        .map(|(name, count)| CollectionInfo { name, count })
        .collect();

    let total_docs: usize = collections.iter().map(|c| c.count).sum();

    // Store database in state
    let mut databases = data.databases.write();
    databases.insert(db_path.clone(), Arc::new(db));

    // Register in system database
    if let Err(e) = data.system_db.register_connection(&db_path) {
        log::warn!("Failed to register connection in system db: {}", e);
    }
    
    // Update stats
    if let Err(e) = data.system_db.update_connection_stats(&db_path, collections.len(), total_docs) {
        log::warn!("Failed to update connection stats: {}", e);
    }

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "open_database", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(HttpResponse::Ok().json(DatabaseInfo {
        path: db_path,
        collections,
    }))
}

async fn create_database(
    data: web::Data<AppState>,
    req: web::Json<OpenDatabaseRequest>,
) -> Result<HttpResponse> {
    let db_path = req.path.clone();
    let start = std::time::Instant::now();
    
    // Create new database
    let db = Database::create(&db_path)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    let collections: Vec<CollectionInfo> = vec![];

    // Store database in state
    let mut databases = data.databases.write();
    databases.insert(db_path.clone(), Arc::new(db));

    // Register in system database
    if let Err(e) = data.system_db.register_connection(&db_path) {
        log::warn!("Failed to register connection in system db: {}", e);
    }

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "create_database", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(HttpResponse::Ok().json(DatabaseInfo {
        path: db_path,
        collections,
    }))
}

async fn list_databases(data: web::Data<AppState>) -> Result<HttpResponse> {
    let databases = data.databases.read();
    let db_list: Vec<String> = databases.keys().cloned().collect();
    Ok(HttpResponse::Ok().json(db_list))
}

async fn get_collections(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let collections: Vec<CollectionInfo> = db
        .list_collections()
        .into_iter()
        .map(|(name, count)| CollectionInfo { name, count })
        .collect();

    Ok(HttpResponse::Ok().json(collections))
}

async fn insert_document(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<InsertRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let start = std::time::Instant::now();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let id = db
        .insert(&req.collection, req.document.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    // Sync to disk
    db.sync()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "insert_document", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "id": id })))
}

async fn find_documents(
    data: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<QueryRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let docs = db
        .find_all(&query.collection, query.limit, query.skip)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    let docs_json: Vec<serde_json::Value> = docs
        .into_iter()
        .map(|doc| doc.to_value())
        .collect();

    Ok(HttpResponse::Ok().json(docs_json))
}

async fn find_by_id(
    data: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> Result<HttpResponse> {
    let (db_path, collection, doc_id) = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let doc = db
        .find_by_id(&collection, &doc_id)
        .map_err(|e| actix_web::error::ErrorNotFound(e.to_string()))?;

    Ok(HttpResponse::Ok().json(doc.to_value()))
}

async fn update_document(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<UpdateRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let doc = db
        .update(&req.collection, &req.id, req.document.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(doc.to_value()))
}

async fn delete_document(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<DeleteRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let doc = db
        .delete(&req.collection, &req.id)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(doc.to_value()))
}

async fn get_stats(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let collections = db.list_collections();
    let total_docs: usize = collections.iter().map(|(_, count)| count).sum();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "path": db_path,
        "collections": collections.len(),
        "total_documents": total_docs,
        "collections_detail": collections
    })))
}

async fn get_system_stats(data: web::Data<AppState>) -> Result<HttpResponse> {
    let stats = data
        .system_db
        .get_system_stats()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(stats))
}

async fn get_connection_history(data: web::Data<AppState>) -> Result<HttpResponse> {
    let connections = data
        .system_db
        .list_connections()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(connections))
}

#[derive(Deserialize)]
struct MetricsQuery {
    limit: Option<usize>,
}

async fn get_database_metrics(
    data: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<MetricsQuery>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    
    let metrics = data
        .system_db
        .get_metrics(&db_path, query.limit)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(metrics))
}

async fn remove_connection(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    
    // Remove from active connections
    {
        let mut databases = data.databases.write();
        databases.remove(&db_path);
    }

    // Remove from system database
    data.system_db
        .remove_connection(&db_path)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Connection removed",
        "path": db_path
    })))
}

async fn close_database(
    data: web::Data<AppState>,
    req: web::Json<CloseDatabaseRequest>,
) -> Result<HttpResponse> {
    let db_path = req.path.clone();
    
    // Remove from active connections
    {
        let mut databases = data.databases.write();
        databases.remove(&db_path);
    }

    log::info!("Database closed: {}", db_path);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Database closed successfully",
        "path": db_path
    })))
}

async fn drop_collection(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<DropCollectionRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let collection = req.collection.clone();
    let start = std::time::Instant::now();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    // Delete all documents in the collection
    let docs = db
        .find_all(&collection, None, None)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;
    
    let mut deleted_count = 0;
    for doc in docs {
        if let Err(e) = db.delete(&collection, &doc.id) {
            log::warn!("Failed to delete document {}: {}", doc.id, e);
        } else {
            deleted_count += 1;
        }
    }

    // Sync to disk
    db.sync()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "drop_collection", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    log::info!("Collection '{}' dropped from database: {} ({} documents deleted)", 
               collection, db_path, deleted_count);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Collection dropped successfully",
        "collection": collection,
        "documents_deleted": deleted_count
    })))
}

async fn delete_database(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    
    // First, close the database connection
    {
        let mut databases = data.databases.write();
        databases.remove(&db_path);
    }

    // Delete the database file
    match std::fs::remove_file(&db_path) {
        Ok(_) => {
            // Remove from system database
            if let Err(e) = data.system_db.remove_connection(&db_path) {
                log::warn!("Failed to remove connection from system db: {}", e);
            }

            log::info!("Database deleted: {}", db_path);

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "message": "Database deleted successfully",
                "path": db_path
            })))
        }
        Err(e) => {
            log::error!("Failed to delete database file {}: {}", db_path, e);
            Err(actix_web::error::ErrorInternalServerError(format!(
                "Failed to delete database file: {}",
                e
            )))
        }
    }
}

// ============================================================
// Vector Database API Handlers
// ============================================================

fn parse_distance(s: &str) -> Distance {
    match s.to_lowercase().as_str() {
        "euclidean" | "l2" => Distance::Euclidean,
        "dot" | "dot_product" | "dotproduct" => Distance::DotProduct,
        "manhattan" | "l1" => Distance::Manhattan,
        _ => Distance::Cosine, // Default
    }
}

async fn create_vector_collection(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<CreateVectorCollectionRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let config = VectorConfig::new(req.dimensions)
        .with_distance(parse_distance(&req.distance))
        .with_m(req.m);

    db.create_vector_collection(&req.name, config)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    log::info!("Vector collection '{}' created in database: {}", req.name, db_path);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Vector collection created successfully",
        "name": req.name,
        "dimensions": req.dimensions,
        "distance": req.distance
    })))
}

async fn list_vector_collections(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let collections = db.list_vector_collections();
    
    // Get detailed stats for each collection
    let collection_infos: Vec<serde_json::Value> = collections
        .iter()
        .filter_map(|(name, count)| {
            db.vector_stats(name).ok().map(|stats| {
                serde_json::json!({
                    "name": name,
                    "count": count,
                    "dimensions": stats.dimensions,
                    "distance": stats.distance.name()
                })
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(collection_infos))
}

async fn get_vector_collection_stats(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (db_path, collection_name) = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let stats = db.vector_stats(&collection_name)
        .map_err(|e| actix_web::error::ErrorNotFound(e.to_string()))?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "name": stats.name,
        "vector_count": stats.vector_count,
        "dimensions": stats.dimensions,
        "distance": stats.distance.name(),
        "memory_bytes": stats.memory_bytes,
        "hnsw_m": stats.hnsw_layers,
        "lazy_embedding": stats.lazy_embedding,
        "compression_mode": format!("{:?}", stats.compression_mode)
    })))
}

async fn insert_vector(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<InsertVectorRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let start = std::time::Instant::now();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let id = db.insert_vector(&req.collection, req.vector.clone(), req.metadata.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "insert_vector", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": id,
        "dimensions": req.vector.len()
    })))
}

async fn vector_search(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<VectorSearchRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let start = std::time::Instant::now();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let results = db.vector_search(&req.collection, &req.vector, req.k)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    let response: Vec<VectorSearchResultResponse> = results
        .into_iter()
        .map(|r| VectorSearchResultResponse {
            id: r.document.id,
            score: r.score,
            vector: r.document.embedding.clone().unwrap_or_default(),
            metadata: if r.document.metadata == serde_json::Value::Null { 
                None 
            } else { 
                Some(r.document.metadata.clone()) 
            },
        })
        .collect();

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = data.system_db.record_metric(&db_path, "vector_search", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(HttpResponse::Ok().json(response))
}

async fn get_vector(
    data: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
) -> Result<HttpResponse> {
    let (db_path, collection_name, vector_id) = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let doc = db.get_vector(&collection_name, vector_id)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?
        .ok_or_else(|| actix_web::error::ErrorNotFound("Vector not found"))?;

    let response = VectorDocumentResponse {
        id: doc.id,
        vector: doc.embedding.clone().unwrap_or_default(),
        metadata: if doc.metadata == serde_json::Value::Null { 
            None 
        } else { 
            Some(doc.metadata.clone()) 
        },
        created_at: 0, // VectorDocument doesn't have created_at, use 0
    };

    Ok(HttpResponse::Ok().json(response))
}

async fn get_all_vectors(
    data: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<GetAllVectorsRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    // Get collection stats to get all IDs
    let stats = db.vector_stats(&query.collection)
        .map_err(|e| actix_web::error::ErrorNotFound(e.to_string()))?;
    
    let limit = query.limit.unwrap_or(100);
    let skip = query.skip.unwrap_or(0);
    
    // Fetch vectors by iterating through IDs
    let mut vectors: Vec<VectorDocumentResponse> = Vec::new();
    let mut found = 0;
    let mut skipped = 0;
    
    // We need to iterate through possible vector IDs
    // This is a simple approach - in production you'd want an iterator
    for id in 0..stats.vector_count as u64 + skip as u64 + 100 {
        if let Ok(Some(doc)) = db.get_vector(&query.collection, id) {
            if skipped < skip {
                skipped += 1;
                continue;
            }
            
            vectors.push(VectorDocumentResponse {
                id: doc.id,
                vector: doc.embedding.clone().unwrap_or_default(),
                metadata: if doc.metadata == serde_json::Value::Null { 
                    None 
                } else { 
                    Some(doc.metadata.clone()) 
                },
                created_at: 0, // VectorDocument doesn't have created_at
            });
            
            found += 1;
            if found >= limit {
                break;
            }
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "vectors": vectors,
        "total": stats.vector_count,
        "limit": limit,
        "skip": skip
    })))
}

async fn delete_vector(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: web::Json<DeleteVectorRequest>,
) -> Result<HttpResponse> {
    let db_path = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let deleted = db.delete_vector(&req.collection, req.id)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "deleted": deleted,
        "id": req.id
    })))
}

async fn drop_vector_collection(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (db_path, collection_name) = path.into_inner();
    let databases = data.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| actix_web::error::ErrorNotFound("Database not found"))?;

    let dropped = db.drop_vector_collection(&collection_name)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    log::info!("Vector collection '{}' dropped from database: {}", collection_name, db_path);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "dropped": dropped,
        "name": collection_name
    })))
}

// Document parsing endpoint
async fn parse_document(mut payload: Multipart) -> Result<HttpResponse> {
    let mut file_data: Vec<u8> = Vec::new();
    let mut filename = String::new();

    // Process multipart form data
    while let Some(item) = payload.next().await {
        let mut field = item.map_err(|e| actix_web::error::ErrorBadRequest(e.to_string()))?;
        
        // Get filename from content disposition
        if let Some(content_disposition) = field.content_disposition() {
            if let Some(name) = content_disposition.get_filename() {
                filename = name.to_string();
            }
        }

        // Read file data
        while let Some(chunk) = field.next().await {
            let data = chunk.map_err(|e| actix_web::error::ErrorBadRequest(e.to_string()))?;
            file_data.extend_from_slice(&data);
        }
    }

    if filename.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No filename provided"
        })));
    }

    if file_data.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No file data received"
        })));
    }

    log::info!("Parsing document: {} ({} bytes)", filename, file_data.len());

    match document_parser::parse_document(&file_data, &filename) {
        Ok(parsed) => {
            log::info!("Successfully parsed {}: {} chars, {} pages", 
                filename, parsed.text.len(), parsed.pages);
            
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "filename": filename,
                "text": parsed.text,
                "pages": parsed.pages,
                "file_type": parsed.file_type,
                "char_count": parsed.text.len()
            })))
        }
        Err(e) => {
            log::error!("Failed to parse {}: {}", filename, e);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": false,
                "filename": filename,
                "error": e
            })))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Initialize system database
    let system_db = SystemDatabase::init()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    
    log::info!("System database initialized");

    let state = web::Data::new(AppState {
        databases: Arc::new(RwLock::new(HashMap::new())),
        system_db: Arc::new(system_db),
    });

    log::info!("Starting keradb Labs API server on http://localhost:5800");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(state.clone())
            .route("/health", web::get().to(health_check))
            // Database management
            .route("/api/databases", web::get().to(list_databases))
            .route("/api/databases/open", web::post().to(open_database))
            .route("/api/databases/create", web::post().to(create_database))
            .route("/api/databases/close", web::post().to(close_database))
            .route("/api/databases/{db}", web::delete().to(delete_database))
            .route("/api/databases/{db}/collections", web::get().to(get_collections))
            .route("/api/databases/{db}/collections", web::delete().to(drop_collection))
            .route("/api/databases/{db}/stats", web::get().to(get_stats))
            // Document operations
            .route("/api/databases/{db}/documents", web::post().to(insert_document))
            .route("/api/databases/{db}/documents", web::get().to(find_documents))
            .route("/api/databases/{db}/documents/{collection}/{id}", web::get().to(find_by_id))
            .route("/api/databases/{db}/documents", web::put().to(update_document))
            .route("/api/databases/{db}/documents", web::delete().to(delete_document))
            // System database endpoints
            .route("/api/system/stats", web::get().to(get_system_stats))
            .route("/api/system/connections", web::get().to(get_connection_history))
            .route("/api/system/connections/{db}", web::delete().to(remove_connection))
            .route("/api/system/metrics/{db}", web::get().to(get_database_metrics))
            // Vector database endpoints
            .route("/api/databases/{db}/vectors/collections", web::post().to(create_vector_collection))
            .route("/api/databases/{db}/vectors/collections", web::get().to(list_vector_collections))
            .route("/api/databases/{db}/vectors/collections/{collection}/stats", web::get().to(get_vector_collection_stats))
            .route("/api/databases/{db}/vectors/collections/{collection}", web::delete().to(drop_vector_collection))
            .route("/api/databases/{db}/vectors", web::post().to(insert_vector))
            .route("/api/databases/{db}/vectors", web::get().to(get_all_vectors))
            .route("/api/databases/{db}/vectors/search", web::post().to(vector_search))
            .route("/api/databases/{db}/vectors/{collection}/{id}", web::get().to(get_vector))
            .route("/api/databases/{db}/vectors", web::delete().to(delete_vector))
            // Document parsing endpoint
            .route("/api/parse-document", web::post().to(parse_document))
    })
    .bind(("127.0.0.1", 5800))?
    .run()
    .await
}
