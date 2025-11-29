import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';

export interface DatabaseInfo {
  path: string;
  collections: CollectionInfo[];
}

export interface CollectionInfo {
  name: string;
  count: number;
}

export interface DatabaseConnection {
  id: string;
  path: string;
  created_at: string;
  last_accessed: string;
  access_count: number;
  collections_count: number;
  total_documents: number;
}

export interface PerformanceMetric {
  id: string;
  database_path: string;
  operation: string;
  duration_ms: number;
  timestamp: string;
}

// Vector types
export interface VectorCollectionInfo {
  name: string;
  count: number;
  dimensions: number;
  distance: string;
}

export interface VectorCollectionStats {
  name: string;
  vector_count: number;
  dimensions: number;
  distance: string;
  memory_bytes: number;
  hnsw_m: number;
  lazy_embedding: boolean;
  compression_mode: string;
}

export interface VectorDocument {
  id: number;
  vector: number[];
  metadata: Record<string, any> | null;
  created_at: number;
}

export interface VectorSearchResult {
  id: number;
  score: number;
  vector: number[];
  metadata: Record<string, any> | null;
}

export interface VectorsResponse {
  vectors: VectorDocument[];
  total: number;
  limit: number;
  skip: number;
}

export const api = {
  // Database Management
  async openDatabase(path: string): Promise<DatabaseInfo> {
    return invoke('open_database', { path });
  },

  async createDatabase(path: string): Promise<DatabaseInfo> {
    return invoke('create_database', { path });
  },

  async listDatabases(): Promise<string[]> {
    return invoke('list_databases');
  },

  async closeDatabase(dbPath: string): Promise<string> {
    return invoke('close_database', { dbPath });
  },

  async deleteDatabase(dbPath: string): Promise<string> {
    return invoke('delete_database', { dbPath });
  },

  // Collection Management
  async getCollections(dbPath: string): Promise<CollectionInfo[]> {
    return invoke('get_collections', { dbPath });
  },

  async dropCollection(dbPath: string, collection: string): Promise<any> {
    return invoke('drop_collection', { dbPath, collection });
  },

  // Document Operations
  async insertDocument(
    dbPath: string,
    collection: string,
    document: any
  ): Promise<string> {
    return invoke('insert_document', { dbPath, collection, document });
  },

  async findDocuments(
    dbPath: string,
    collection: string,
    limit?: number,
    skip?: number
  ): Promise<any[]> {
    return invoke('find_documents', { dbPath, collection, limit, skip });
  },

  async findById(
    dbPath: string,
    collection: string,
    docId: string
  ): Promise<any> {
    return invoke('find_by_id', { dbPath, collection, docId });
  },

  async updateDocument(
    dbPath: string,
    collection: string,
    id: string,
    document: any
  ): Promise<any> {
    return invoke('update_document', { dbPath, collection, id, document });
  },

  async deleteDocument(
    dbPath: string,
    collection: string,
    id: string
  ): Promise<any> {
    return invoke('delete_document', { dbPath, collection, id });
  },

  // Statistics
  async getStats(dbPath: string): Promise<any> {
    return invoke('get_stats', { dbPath });
  },

  async getSystemStats(): Promise<any> {
    return invoke('get_system_stats');
  },

  async getConnectionHistory(): Promise<DatabaseConnection[]> {
    return invoke('get_connection_history');
  },

  async getDatabaseMetrics(
    dbPath: string,
    limit?: number
  ): Promise<PerformanceMetric[]> {
    return invoke('get_database_metrics', { dbPath, limit });
  },

  async removeConnection(dbPath: string): Promise<string> {
    return invoke('remove_connection', { dbPath });
  },

  // File Dialogs
  async openFileDialog(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'NoSQLite Database',
        extensions: ['ndb', 'nsql']
      }]
    });
    return typeof selected === 'string' ? selected : null;
  },

  async saveFileDialog(): Promise<string | null> {
    const selected = await save({
      filters: [{
        name: 'NoSQLite Database',
        extensions: ['ndb', 'nsql']
      }]
    });
    return selected;
  },

  // Vector Database Operations
  async createVectorCollection(
    dbPath: string,
    name: string,
    dimensions: number,
    distance: string = 'cosine',
    m: number = 16,
    efConstruction: number = 200
  ): Promise<any> {
    return invoke('create_vector_collection', { 
      dbPath, 
      name, 
      dimensions, 
      distance, 
      m, 
      efConstruction 
    });
  },

  async listVectorCollections(dbPath: string): Promise<VectorCollectionInfo[]> {
    return invoke('list_vector_collections', { dbPath });
  },

  async getVectorCollectionStats(
    dbPath: string,
    collection: string
  ): Promise<VectorCollectionStats> {
    return invoke('get_vector_collection_stats', { dbPath, collection });
  },

  async dropVectorCollection(dbPath: string, collection: string): Promise<any> {
    return invoke('drop_vector_collection', { dbPath, collection });
  },

  async insertVector(
    dbPath: string,
    collection: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<{ id: number; dimensions: number }> {
    return invoke('insert_vector', { dbPath, collection, vector, metadata });
  },

  async getVectors(
    dbPath: string,
    collection: string,
    limit?: number,
    skip?: number
  ): Promise<VectorsResponse> {
    return invoke('get_vectors', { dbPath, collection, limit, skip });
  },

  async vectorSearch(
    dbPath: string,
    collection: string,
    vector: number[],
    k: number
  ): Promise<VectorSearchResult[]> {
    return invoke('vector_search', { dbPath, collection, vector, k });
  },

  async getVector(
    dbPath: string,
    collection: string,
    id: number
  ): Promise<VectorDocument> {
    return invoke('get_vector', { dbPath, collection, id });
  },

  async deleteVector(
    dbPath: string,
    collection: string,
    id: number
  ): Promise<{ deleted: boolean; id: number }> {
    return invoke('delete_vector', { dbPath, collection, id });
  },

  // Document parsing - uses backend for better PDF/DOCX/Excel parsing
  async parseDocument(file: File): Promise<{
    success: boolean;
    filename: string;
    text?: string;
    pages?: number;
    file_type?: string;
    char_count?: number;
    error?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('http://localhost:5800/api/parse-document', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to parse document: ${response.statusText}`);
    }

    return response.json();
  }
};
