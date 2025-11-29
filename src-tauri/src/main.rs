// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod system_db;

use keradb::{Database, VectorConfig, Distance};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use system_db::SystemDatabase;
use tauri::State;

// App state
struct AppState {
    databases: Arc<RwLock<HashMap<String, Arc<Database>>>>,
    system_db: Arc<SystemDatabase>,
}

// Request/Response types
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
struct QueryParams {
    limit: Option<usize>,
    skip: Option<usize>,
}

// Tauri Commands

#[tauri::command]
fn open_database(path: String, state: State<AppState>) -> Result<DatabaseInfo, String> {
    let start = std::time::Instant::now();
    
    log::info!("Opening database: {}", path);
    
    // Open or create database
    let db = match Database::open(&path) {
        Ok(db) => db,
        Err(_) => Database::create(&path).map_err(|e| e.to_string())?,
    };

    let collections: Vec<CollectionInfo> = db
        .list_collections()
        .into_iter()
        .map(|(name, count)| CollectionInfo { name, count })
        .collect();

    let total_docs: usize = collections.iter().map(|c| c.count).sum();

    // Store database in state
    let mut databases = state.databases.write();
    databases.insert(path.clone(), Arc::new(db));

    // Register in system database
    if let Err(e) = state.system_db.register_connection(&path) {
        log::warn!("Failed to register connection in system db: {}", e);
    }
    
    // Update stats
    if let Err(e) = state.system_db.update_connection_stats(&path, collections.len(), total_docs) {
        log::warn!("Failed to update connection stats: {}", e);
    }

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = state.system_db.record_metric(&path, "open_database", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(DatabaseInfo {
        path,
        collections,
    })
}

#[tauri::command]
fn create_database(path: String, state: State<AppState>) -> Result<DatabaseInfo, String> {
    let start = std::time::Instant::now();
    
    log::info!("Creating database: {}", path);
    
    // Create new database
    let db = Database::create(&path).map_err(|e| e.to_string())?;

    let collections: Vec<CollectionInfo> = vec![];

    // Store database in state
    let mut databases = state.databases.write();
    databases.insert(path.clone(), Arc::new(db));

    // Register in system database
    if let Err(e) = state.system_db.register_connection(&path) {
        log::warn!("Failed to register connection in system db: {}", e);
    }

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = state.system_db.record_metric(&path, "create_database", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(DatabaseInfo {
        path,
        collections,
    })
}

#[tauri::command]
fn list_databases(state: State<AppState>) -> Result<Vec<String>, String> {
    let databases = state.databases.read();
    let db_list: Vec<String> = databases.keys().cloned().collect();
    Ok(db_list)
}

#[tauri::command]
fn get_collections(db_path: String, state: State<AppState>) -> Result<Vec<CollectionInfo>, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let collections: Vec<CollectionInfo> = db
        .list_collections()
        .into_iter()
        .map(|(name, count)| CollectionInfo { name, count })
        .collect();

    Ok(collections)
}

#[tauri::command]
fn insert_document(
    db_path: String,
    collection: String,
    document: serde_json::Value,
    state: State<AppState>,
) -> Result<String, String> {
    let start = std::time::Instant::now();
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let id = db.insert(&collection, document).map_err(|e| e.to_string())?;

    // Sync to disk
    db.sync().map_err(|e| e.to_string())?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = state.system_db.record_metric(&db_path, "insert_document", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(id)
}

#[tauri::command]
fn find_documents(
    db_path: String,
    collection: String,
    limit: Option<usize>,
    skip: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let docs = db
        .find_all(&collection, limit, skip)
        .map_err(|e| e.to_string())?;

    let docs_json: Vec<serde_json::Value> = docs
        .into_iter()
        .map(|doc| doc.to_value())
        .collect();

    Ok(docs_json)
}

#[tauri::command]
fn find_by_id(
    db_path: String,
    collection: String,
    doc_id: String,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let doc = db
        .find_by_id(&collection, &doc_id)
        .map_err(|e| e.to_string())?;

    Ok(doc.to_value())
}

#[tauri::command]
fn update_document(
    db_path: String,
    collection: String,
    id: String,
    document: serde_json::Value,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let doc = db
        .update(&collection, &id, document)
        .map_err(|e| e.to_string())?;

    Ok(doc.to_value())
}

#[tauri::command]
fn delete_document(
    db_path: String,
    collection: String,
    id: String,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let doc = db
        .delete(&collection, &id)
        .map_err(|e| e.to_string())?;

    Ok(doc.to_value())
}

#[tauri::command]
fn get_stats(db_path: String, state: State<AppState>) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let collections = db.list_collections();
    let total_docs: usize = collections.iter().map(|(_, count)| count).sum();

    Ok(serde_json::json!({
        "path": db_path,
        "collections": collections.len(),
        "total_documents": total_docs,
        "collections_detail": collections
    }))
}

#[tauri::command]
fn get_system_stats(state: State<AppState>) -> Result<serde_json::Value, String> {
    let stats = state
        .system_db
        .get_system_stats()
        .map_err(|e| e.to_string())?;

    Ok(stats)
}

#[tauri::command]
fn get_connection_history(state: State<AppState>) -> Result<serde_json::Value, String> {
    let connections = state
        .system_db
        .list_connections()
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(connections).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn get_database_metrics(
    db_path: String,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let metrics = state
        .system_db
        .get_metrics(&db_path, limit)
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(metrics).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn remove_connection(db_path: String, state: State<AppState>) -> Result<String, String> {
    // Remove from active connections
    {
        let mut databases = state.databases.write();
        databases.remove(&db_path);
    }

    // Remove from system database
    state
        .system_db
        .remove_connection(&db_path)
        .map_err(|e| e.to_string())?;

    Ok(format!("Connection removed: {}", db_path))
}

#[tauri::command]
fn close_database(db_path: String, state: State<AppState>) -> Result<String, String> {
    // Remove from active connections
    {
        let mut databases = state.databases.write();
        databases.remove(&db_path);
    }

    log::info!("Database closed: {}", db_path);

    Ok(format!("Database closed successfully: {}", db_path))
}

#[tauri::command]
fn drop_collection(
    db_path: String,
    collection: String,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let start = std::time::Instant::now();
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    // Delete all documents in the collection
    let docs = db
        .find_all(&collection, None, None)
        .map_err(|e| e.to_string())?;
    
    let mut deleted_count = 0;
    for doc in docs {
        if let Err(e) = db.delete(&collection, &doc.id) {
            log::warn!("Failed to delete document {}: {}", doc.id, e);
        } else {
            deleted_count += 1;
        }
    }

    // Sync to disk
    db.sync().map_err(|e| e.to_string())?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = state.system_db.record_metric(&db_path, "drop_collection", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    log::info!("Collection '{}' dropped from database: {} ({} documents deleted)", 
               collection, db_path, deleted_count);

    Ok(serde_json::json!({
        "message": "Collection dropped successfully",
        "collection": collection,
        "documents_deleted": deleted_count
    }))
}

#[tauri::command]
fn delete_database(db_path: String, state: State<AppState>) -> Result<String, String> {
    // First, close the database connection
    {
        let mut databases = state.databases.write();
        databases.remove(&db_path);
    }

    // Delete the database file
    std::fs::remove_file(&db_path).map_err(|e| {
        log::error!("Failed to delete database file {}: {}", db_path, e);
        format!("Failed to delete database file: {}", e)
    })?;

    // Remove from system database
    if let Err(e) = state.system_db.remove_connection(&db_path) {
        log::warn!("Failed to remove connection from system db: {}", e);
    }

    log::info!("Database deleted: {}", db_path);

    Ok(format!("Database deleted successfully: {}", db_path))
}

// ============================================================
// Vector Database Commands
// ============================================================

fn parse_distance(s: &str) -> Distance {
    match s.to_lowercase().as_str() {
        "euclidean" | "l2" => Distance::Euclidean,
        "dot" | "dot_product" | "dotproduct" => Distance::DotProduct,
        "manhattan" | "l1" => Distance::Manhattan,
        _ => Distance::Cosine,
    }
}

#[derive(Serialize, Deserialize)]
struct VectorCollectionInfoResponse {
    name: String,
    count: usize,
    dimensions: usize,
    distance: String,
}

#[derive(Serialize, Deserialize)]
struct VectorDocumentResponse {
    id: u64,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
    created_at: u64,
}

#[derive(Serialize, Deserialize)]
struct VectorSearchResultResponse {
    id: u64,
    score: f32,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
}

#[tauri::command]
fn create_vector_collection(
    db_path: String,
    name: String,
    dimensions: usize,
    distance: String,
    m: Option<usize>,
    ef_construction: Option<usize>,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let mut config = VectorConfig::new(dimensions)
        .with_distance(parse_distance(&distance));
    
    if let Some(m_val) = m {
        config = config.with_m(m_val);
    }

    db.create_vector_collection(&name, config)
        .map_err(|e| e.to_string())?;

    log::info!("Vector collection '{}' created in database: {}", name, db_path);

    Ok(serde_json::json!({
        "message": "Vector collection created successfully",
        "name": name,
        "dimensions": dimensions,
        "distance": distance
    }))
}

#[tauri::command]
fn list_vector_collections(
    db_path: String,
    state: State<AppState>,
) -> Result<Vec<VectorCollectionInfoResponse>, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let collections = db.list_vector_collections();
    
    let collection_infos: Vec<VectorCollectionInfoResponse> = collections
        .iter()
        .filter_map(|(name, count)| {
            db.vector_stats(name).ok().map(|stats| {
                VectorCollectionInfoResponse {
                    name: name.clone(),
                    count: *count,
                    dimensions: stats.dimensions,
                    distance: stats.distance.name().to_string(),
                }
            })
        })
        .collect();

    Ok(collection_infos)
}

#[tauri::command]
fn get_vector_collection_stats(
    db_path: String,
    collection: String,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let stats = db.vector_stats(&collection)
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "name": stats.name,
        "vector_count": stats.vector_count,
        "dimensions": stats.dimensions,
        "distance": stats.distance.name(),
        "memory_bytes": stats.memory_bytes,
        "hnsw_m": stats.hnsw_layers,
        "lazy_embedding": stats.lazy_embedding,
        "compression_mode": format!("{:?}", stats.compression_mode)
    }))
}

#[tauri::command]
fn drop_vector_collection(
    db_path: String,
    collection: String,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let dropped = db.drop_vector_collection(&collection)
        .map_err(|e| e.to_string())?;

    log::info!("Vector collection '{}' dropped from database: {}", collection, db_path);

    Ok(serde_json::json!({
        "dropped": dropped,
        "name": collection
    }))
}

#[tauri::command]
fn insert_vector(
    db_path: String,
    collection: String,
    vector: Vec<f32>,
    metadata: Option<serde_json::Value>,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let start = std::time::Instant::now();
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let id = db.insert_vector(&collection, vector.clone(), metadata)
        .map_err(|e| e.to_string())?;

    // Record metric
    let duration = start.elapsed().as_millis() as u64;
    if let Err(e) = state.system_db.record_metric(&db_path, "insert_vector", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(serde_json::json!({
        "id": id,
        "dimensions": vector.len()
    }))
}

#[tauri::command]
fn get_vectors(
    db_path: String,
    collection: String,
    limit: Option<usize>,
    skip: Option<usize>,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let stats = db.vector_stats(&collection)
        .map_err(|e| e.to_string())?;
    
    let limit = limit.unwrap_or(100);
    let skip = skip.unwrap_or(0);
    
    let mut vectors: Vec<VectorDocumentResponse> = Vec::new();
    let mut found = 0;
    let mut skipped = 0;
    
    for id in 0..stats.vector_count as u64 + skip as u64 + 100 {
        if let Ok(Some(doc)) = db.get_vector(&collection, id) {
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
                created_at: 0,
            });
            
            found += 1;
            if found >= limit {
                break;
            }
        }
    }

    Ok(serde_json::json!({
        "vectors": vectors,
        "total": stats.vector_count,
        "limit": limit,
        "skip": skip
    }))
}

#[tauri::command]
fn vector_search(
    db_path: String,
    collection: String,
    vector: Vec<f32>,
    k: usize,
    state: State<AppState>,
) -> Result<Vec<VectorSearchResultResponse>, String> {
    let start = std::time::Instant::now();
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let results = db.vector_search(&collection, &vector, k)
        .map_err(|e| e.to_string())?;

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
    if let Err(e) = state.system_db.record_metric(&db_path, "vector_search", duration) {
        log::warn!("Failed to record metric: {}", e);
    }

    Ok(response)
}

#[tauri::command]
fn get_vector(
    db_path: String,
    collection: String,
    id: u64,
    state: State<AppState>,
) -> Result<VectorDocumentResponse, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let doc = db.get_vector(&collection, id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Vector not found".to_string())?;

    Ok(VectorDocumentResponse {
        id: doc.id,
        vector: doc.embedding.clone().unwrap_or_default(),
        metadata: if doc.metadata == serde_json::Value::Null { 
            None 
        } else { 
            Some(doc.metadata.clone()) 
        },
        created_at: 0, // VectorDocument doesn't have created_at
    })
}

#[tauri::command]
fn delete_vector(
    db_path: String,
    collection: String,
    id: u64,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let databases = state.databases.read();
    
    let db = databases
        .get(&db_path)
        .ok_or_else(|| "Database not found".to_string())?;

    let deleted = db.delete_vector(&collection, id)
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "deleted": deleted,
        "id": id
    }))
}

fn main() {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Initialize system database
    let system_db = SystemDatabase::init().expect("Failed to initialize system database");
    
    log::info!("System database initialized");

    tauri::Builder::default()
        .manage(AppState {
            databases: Arc::new(RwLock::new(HashMap::new())),
            system_db: Arc::new(system_db),
        })
        .invoke_handler(tauri::generate_handler![
            open_database,
            create_database,
            list_databases,
            get_collections,
            insert_document,
            find_documents,
            find_by_id,
            update_document,
            delete_document,
            get_stats,
            get_system_stats,
            get_connection_history,
            get_database_metrics,
            remove_connection,
            close_database,
            drop_collection,
            delete_database,
            // Vector commands
            create_vector_collection,
            list_vector_collections,
            get_vector_collection_stats,
            drop_vector_collection,
            insert_vector,
            get_vectors,
            vector_search,
            get_vector,
            delete_vector,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
