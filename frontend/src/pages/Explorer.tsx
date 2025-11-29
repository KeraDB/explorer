import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, VectorCollectionInfo, VectorDocument, VectorSearchResult, VectorCollectionStats } from '../api'
import VectorVisualization from '../components/VectorVisualization'
import { parseFiles, ACCEPT_STRING, ParsedFile } from '../utils/fileParser'
import { 
  Database, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  FileJson,
  Search,
  Box,
  Layers,
  Upload,
  FileText,
  X,
  Play,
  Info,
  Cpu
} from 'lucide-react'
import Editor from '@monaco-editor/react'

type ExplorerTab = 'documents' | 'vectors'

interface ExplorerProps {
  database: string | null
}

interface Collection {
  name: string
  count: number
}

interface Document {
  _id: string
  _created: number
  _updated: number
  [key: string]: any
}

export default function Explorer({ database }: ExplorerProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ExplorerTab>('documents')
  
  // Document collection state
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorValue, setEditorValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  
  // Vector collection state
  const [selectedVectorCollection, setSelectedVectorCollection] = useState<string | null>(null)
  const [showNewVectorCollectionDialog, setShowNewVectorCollectionDialog] = useState(false)
  const [showInsertVectorDialog, setShowInsertVectorDialog] = useState(false)
  const [showSearchVectorDialog, setShowSearchVectorDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedVector, setSelectedVector] = useState<VectorDocument | null>(null)
  
  // Vector form state
  const [newVectorCollectionName, setNewVectorCollectionName] = useState('')
  const [newVectorCollectionDimensions, setNewVectorCollectionDimensions] = useState(384)
  const [newVectorCollectionDistance, setNewVectorCollectionDistance] = useState('cosine')
  const [insertVectorJson, setInsertVectorJson] = useState('{\n  "vector": [0.1, 0.2, 0.3, 0.4],\n  "metadata": {"label": "example"}\n}')
  const [searchVectorJson, setSearchVectorJson] = useState('[]')
  const [searchK, setSearchK] = useState(10)
  const [searchResults, setSearchResults] = useState<VectorSearchResult[]>([])
  const [queryVector, setQueryVector] = useState<number[] | undefined>()
  const [searchMode, setSearchMode] = useState<'text' | 'vector'>('text')
  const [searchText, setSearchText] = useState('')
  
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [chunkSize, setChunkSize] = useState(500)
  
  // Resizable panel state
  const [detailsPanelWidth, setDetailsPanelWidth] = useState(224) // 56 * 4 = 224px (w-56)
  const [isResizing, setIsResizing] = useState(false)
  const resizeContainerRef = useRef<HTMLDivElement>(null)
  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeContainerRef.current) return
      const containerRect = resizeContainerRef.current.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX
      setDetailsPanelWidth(Math.max(160, Math.min(400, newWidth)))
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])
  
  const queryClient = useQueryClient()

  // Fetch collections
  const { data: collections, isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ['collections', database],
    queryFn: async () => {
      return await api.getCollections(database!)
    },
    enabled: !!database,
  })

  // Fetch documents
  const { data: documents, isLoading: loadingDocuments } = useQuery<Document[]>({
    queryKey: ['documents', database, selectedCollection],
    queryFn: async () => {
      return await api.findDocuments(database!, selectedCollection!)
    },
    enabled: !!database && !!selectedCollection,
  })

  // Insert mutation
  const insertMutation = useMutation({
    mutationFn: async (doc: any) => {
      await api.insertDocument(database!, selectedCollection!, doc)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setShowEditor(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, doc }: { id: string; doc: any }) => {
      await api.updateDocument(database!, selectedCollection!, id, doc)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setShowEditor(false)
      setSelectedDocument(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteDocument(database!, selectedCollection!, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSelectedDocument(null)
    },
  })

  // Drop collection mutation
  const dropCollectionMutation = useMutation({
    mutationFn: async (collectionName: string) => {
      await api.dropCollection(database!, collectionName)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSelectedCollection(null)
    },
  })

  // =====================
  // Vector Collection Queries
  // =====================
  
  // Fetch vector collections
  const { data: vectorCollections, isLoading: loadingVectorCollections } = useQuery<VectorCollectionInfo[]>({
    queryKey: ['vectorCollections', database],
    queryFn: async () => {
      return await api.listVectorCollections(database!)
    },
    enabled: !!database,
  })

  // Fetch vector collection stats
  const { data: vectorCollectionStats } = useQuery<VectorCollectionStats>({
    queryKey: ['vectorCollectionStats', database, selectedVectorCollection],
    queryFn: async () => {
      return await api.getVectorCollectionStats(database!, selectedVectorCollection!)
    },
    enabled: !!database && !!selectedVectorCollection,
  })

  // Fetch vectors
  const { data: vectorsResponse, isLoading: loadingVectors } = useQuery({
    queryKey: ['vectors', database, selectedVectorCollection],
    queryFn: async () => {
      return await api.getVectors(database!, selectedVectorCollection!, 100)
    },
    enabled: !!database && !!selectedVectorCollection,
  })

  // Create vector collection mutation
  const createVectorCollectionMutation = useMutation({
    mutationFn: async () => {
      await api.createVectorCollection(
        database!,
        newVectorCollectionName,
        newVectorCollectionDimensions,
        newVectorCollectionDistance
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })
      setShowNewVectorCollectionDialog(false)
      setNewVectorCollectionName('')
      setSelectedVectorCollection(newVectorCollectionName)
    },
  })

  // Drop vector collection mutation
  const dropVectorCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.dropVectorCollection(database!, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })
      setSelectedVectorCollection(null)
    },
  })

  // Insert vector mutation
  const insertVectorMutation = useMutation({
    mutationFn: async ({ vector, metadata }: { vector: number[]; metadata?: Record<string, any> }) => {
      await api.insertVector(database!, selectedVectorCollection!, vector, metadata)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vectors'] })
      queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })
      queryClient.invalidateQueries({ queryKey: ['vectorCollectionStats'] })
      setShowInsertVectorDialog(false)
    },
  })

  // Delete vector mutation
  const deleteVectorMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.deleteVector(database!, selectedVectorCollection!, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vectors'] })
      queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })
      setSelectedVector(null)
    },
  })

  const handleDropCollection = (collectionName: string) => {
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete all documents in the "${collectionName}" collection.\n\nThis action cannot be undone.\n\nAre you sure you want to continue?`
    )
    if (confirmed) {
      dropCollectionMutation.mutate(collectionName)
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      alert('Please enter a collection name')
      return
    }
    
    try {
      // Create a dummy document to initialize the collection
      await api.insertDocument(database!, newCollectionName, { _init: true })
      
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setShowNewCollectionDialog(false)
      setNewCollectionName('')
      setSelectedCollection(newCollectionName)
    } catch (err: any) {
      console.error('Failed to create collection:', err)
      alert(err || 'Failed to create collection')
    }
  }

  const handleCreateDocument = () => {
    setEditorValue(JSON.stringify({ name: '', value: '' }, null, 2))
    setSelectedDocument(null)
    setShowEditor(true)
  }

  const handleEditDocument = (doc: Document) => {
    const { _id, _created, _updated, ...data } = doc
    setEditorValue(JSON.stringify(data, null, 2))
    setSelectedDocument(doc)
    setShowEditor(true)
  }

  const handleSave = () => {
    try {
      const doc = JSON.parse(editorValue)
      if (selectedDocument) {
        updateMutation.mutate({ id: selectedDocument._id, doc })
      } else {
        insertMutation.mutate(doc)
      }
    } catch (err) {
      alert('Invalid JSON')
    }
  }

  const filteredDocuments = documents?.filter((doc) =>
    JSON.stringify(doc).toLowerCase().includes(searchQuery.toLowerCase())
  )

  // =====================
  // Vector Handler Functions
  // =====================
  
  const handleDropVectorCollection = (name: string) => {
    const confirmed = window.confirm(
      `WARNING: This will permanently delete the "${name}" vector collection and all its vectors.\n\nThis action cannot be undone.\n\nAre you sure?`
    )
    if (confirmed) {
      dropVectorCollectionMutation.mutate(name)
    }
  }

  const handleInsertVector = () => {
    try {
      const parsed = JSON.parse(insertVectorJson)
      const vector = parsed.vector || parsed
      const metadata = parsed.metadata
      
      if (!Array.isArray(vector) || !vector.every(x => typeof x === 'number')) {
        alert('Vector must be an array of numbers')
        return
      }
      
      insertVectorMutation.mutate({ vector, metadata })
    } catch (err) {
      alert('Invalid JSON format')
    }
  }

  // Simple text-to-vector using hash-based features
  const textToVector = (text: string, dimensions: number): number[] => {
    const vector = new Array(dimensions).fill(0)
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1)
    
    for (const word of words) {
      let hash = 0
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i)
        hash = hash & hash
      }
      const idx = Math.abs(hash) % dimensions
      vector[idx] += 1
    }
    
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0))
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm
      }
    }
    
    return vector
  }

  const handleVectorSearch = async () => {
    if (!vectorCollectionStats) return
    
    try {
      let vector: number[]
      
      if (searchMode === 'text') {
        if (!searchText.trim()) {
          alert('Please enter search text')
          return
        }
        vector = textToVector(searchText, vectorCollectionStats.dimensions)
      } else {
        try {
          vector = JSON.parse(searchVectorJson)
        } catch {
          alert('Invalid vector JSON')
          return
        }
        
        if (!Array.isArray(vector) || !vector.every(x => typeof x === 'number')) {
          alert('Search vector must be an array of numbers')
          return
        }
      }
      
      const results = await api.vectorSearch(database!, selectedVectorCollection!, vector, searchK)
      setSearchResults(results)
      setQueryVector(vector)
      setShowSearchVectorDialog(false)
    } catch (err: any) {
      alert(`Search failed: ${err.message || err}`)
    }
  }

  const handleGenerateRandomVector = () => {
    if (!vectorCollectionStats) return
    const dims = vectorCollectionStats.dimensions
    const vector = Array.from({ length: dims }, () => Math.random() * 2 - 1)
    setSearchVectorJson(JSON.stringify(vector.map(x => Math.round(x * 1000) / 1000)))
  }

  const handleClearVectorSearch = () => {
    setSearchResults([])
    setQueryVector(undefined)
  }

  // File upload handlers - use backend for PDF/DOCX/Excel, frontend for text files
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setIsProcessingFiles(true)
    try {
      const loadedFiles: ParsedFile[] = []
      
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        
        // Use backend for complex document formats
        if (['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)) {
          try {
            const result = await api.parseDocument(file)
            if (result.success && result.text) {
              loadedFiles.push({
                name: file.name,
                content: result.text,
                size: file.size,
                type: '.' + ext
              })
            } else {
              console.error(`Failed to parse ${file.name}: ${result.error}`)
              loadedFiles.push({
                name: file.name,
                content: `[Error parsing ${file.name}: ${result.error}]`,
                size: file.size,
                type: '.' + ext
              })
            }
          } catch (err) {
            console.error(`Error parsing ${file.name}:`, err)
            // Fallback to frontend parsing
            const parsed = await parseFiles([file])
            loadedFiles.push(...parsed)
          }
        } else {
          // Use frontend for text-based files
          const parsed = await parseFiles([file])
          loadedFiles.push(...parsed)
        }
      }
      
      setUploadedFiles(loadedFiles)
    } catch (error) {
      console.error('Error parsing files:', error)
      alert('Error parsing some files. Please check the console for details.')
    } finally {
      setIsProcessingFiles(false)
    }
  }

  const chunkText = (text: string, size: number): string[] => {
    const chunks: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > size && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        currentChunk += ' ' + sentence
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.length > 0 ? chunks : [text.slice(0, size)]
  }

  const handleProcessFiles = async () => {
    if (!vectorCollectionStats || uploadedFiles.length === 0) return
    
    setIsProcessingFiles(true)
    
    try {
      let totalInserted = 0
      
      for (const file of uploadedFiles) {
        const chunks = chunkText(file.content, chunkSize)
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const vector = textToVector(chunk, vectorCollectionStats.dimensions)
          
          await api.insertVector(database!, selectedVectorCollection!, vector, {
            source: file.name,
            chunk_index: i,
            total_chunks: chunks.length,
            text_preview: chunk.slice(0, 100) + (chunk.length > 100 ? '...' : ''),
            char_count: chunk.length
          })
          
          totalInserted++
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['vectors'] })
      queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })
      queryClient.invalidateQueries({ queryKey: ['vectorCollectionStats'] })
      
      alert(`Successfully created ${totalInserted} vectors from ${uploadedFiles.length} file(s)`)
      setShowUploadDialog(false)
      setUploadedFiles([])
    } catch (err: any) {
      alert(`Failed to process files: ${err.message || err}`)
    } finally {
      setIsProcessingFiles(false)
    }
  }

  if (!database) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Database className="w-10 h-10 mx-auto mb-2 text-gray-600" />
          <p className="text-gray-400 text-sm">No database selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 px-2">
        <div className="flex gap-0.5">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 flex items-center gap-1 border-b-2 transition text-xs ${
              activeTab === 'documents'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('vectors')}
            className={`px-3 py-1.5 flex items-center gap-1 border-b-2 transition text-xs ${
              activeTab === 'vectors'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Vectors
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'documents' ? (
          /* Documents Tab */
          <>
            {/* Collections sidebar */}
            <div className="w-48 bg-gray-800 border-r border-gray-700 p-2 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-xs">Collections</h2>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setShowNewCollectionDialog(true)}
                    className="p-0.5 hover:bg-gray-700 rounded"
                    title="New Collection"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['collections'] })}
                    className="p-0.5 hover:bg-gray-700 rounded"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {loadingCollections ? (
                <p className="text-gray-400 text-xs">Loading...</p>
              ) : collections && collections.length > 0 ? (
                <ul className="space-y-0.5 flex-1 overflow-y-auto">
                  {collections.map((col) => (
                    <li key={col.name} className="group relative">
                      <button
                        onClick={() => setSelectedCollection(col.name)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                          selectedCollection === col.name
                            ? 'bg-blue-600'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{col.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">{col.count}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDropCollection(col.name)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-600 rounded transition"
                              title="Drop collection"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 text-xs">
                    <Database className="w-8 h-8 mx-auto mb-1 text-gray-600" />
                    <p className="mb-1">No collections</p>
                    <button
                      onClick={() => setShowNewCollectionDialog(true)}
                      className="text-blue-400 hover:text-blue-300 text-[10px]"
                    >
                      Create one
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Documents list */}
            <div className="flex-1 flex flex-col">
              {selectedCollection ? (
                <>
                  <div className="px-2 py-1.5 border-b border-gray-700 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">{selectedCollection}</h2>
                      <p className="text-[10px] text-gray-400">
                        {filteredDocuments?.length || 0} documents
                      </p>
                    </div>
                    <button
                      onClick={handleCreateDocument}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition"
                    >
                      <Plus className="w-3 h-3" />
                      New Doc
                    </button>
                  </div>

                  <div className="px-2 py-1.5 border-b border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full pl-7 pr-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-2">
                    {loadingDocuments ? (
                      <p className="text-gray-400 text-xs">Loading documents...</p>
                    ) : filteredDocuments && filteredDocuments.length > 0 ? (
                      <div className="space-y-1">
                        {filteredDocuments.map((doc) => (
                          <div
                            key={doc._id}
                            className="bg-gray-800 rounded p-2 hover:bg-gray-750 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-1">
                                  <FileJson className="w-3 h-3 text-blue-400" />
                                  <code className="text-[10px] text-gray-400 truncate">
                                    {doc._id}
                                  </code>
                                </div>
                                <pre className="text-[11px] text-gray-300 overflow-x-auto max-h-20">
                                  {JSON.stringify(
                                    Object.fromEntries(
                                      Object.entries(doc).filter(
                                        ([k]) => !k.startsWith('_')
                                      )
                                    ),
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                              <div className="flex gap-0.5 ml-2">
                                <button
                                  onClick={() => handleEditDocument(doc)}
                                  className="p-1 hover:bg-gray-700 rounded transition"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this document?')) {
                                      deleteMutation.mutate(doc._id)
                                    }
                                  }}
                                  className="p-1 hover:bg-red-600 rounded transition"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileJson className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                        <p className="text-gray-400 text-xs">No documents found</p>
                        <button
                          onClick={handleCreateDocument}
                          className="mt-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition"
                        >
                          Create First Document
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Database className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-400 text-xs">Select a collection to view documents</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Vectors Tab */
          <>
            {/* Vector Collections sidebar */}
            <div className="w-56 bg-gray-800 border-r border-gray-700 p-2 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-xs flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Vector Collections
                </h2>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setShowNewVectorCollectionDialog(true)}
                    className="p-0.5 hover:bg-gray-700 rounded"
                    title="New Vector Collection"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['vectorCollections'] })}
                    className="p-0.5 hover:bg-gray-700 rounded"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {loadingVectorCollections ? (
                <p className="text-gray-400 text-xs">Loading...</p>
              ) : vectorCollections && vectorCollections.length > 0 ? (
                <ul className="space-y-0.5 flex-1 overflow-y-auto">
                  {vectorCollections.map((col) => (
                    <li key={col.name} className="group relative">
                      <button
                        onClick={() => {
                          setSelectedVectorCollection(col.name)
                          setSearchResults([])
                          setQueryVector(undefined)
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                          selectedVectorCollection === col.name
                            ? 'bg-purple-600'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-xs">{col.name}</span>
                            <span className="text-[10px] text-gray-400">
                              {col.dimensions}D • {col.distance}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] bg-gray-700 px-1 py-0.5 rounded">
                              {col.count}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDropVectorCollection(col.name)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-600 rounded transition"
                              title="Drop collection"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 text-xs">
                    <Box className="w-8 h-8 mx-auto mb-1 text-gray-600" />
                    <p className="mb-1">No vector collections</p>
                    <button
                      onClick={() => setShowNewVectorCollectionDialog(true)}
                      className="text-purple-400 hover:text-purple-300 text-[10px]"
                    >
                      Create one
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vector content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedVectorCollection ? (
                <>
                  {/* Header */}
                  <div className="px-2 py-1.5 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-1">
                          <Box className="w-3.5 h-3.5 text-purple-400" />
                          {selectedVectorCollection}
                        </h2>
                        {vectorCollectionStats && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <Cpu className="w-2.5 h-2.5" />
                              {vectorCollectionStats.dimensions}D
                            </span>
                            <span>{vectorCollectionStats.vector_count} vecs</span>
                            <span className="text-purple-400">{vectorCollectionStats.distance}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowUploadDialog(true)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
                        title="Upload files to convert to vectors"
                      >
                        <Upload className="w-3 h-3" />
                        Upload
                      </button>
                      <button
                        onClick={() => setShowInsertVectorDialog(true)}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition"
                      >
                        <Plus className="w-3 h-3" />
                        Insert
                      </button>
                      <button
                        onClick={() => setShowSearchVectorDialog(true)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition"
                      >
                        <Search className="w-3 h-3" />
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Search results indicator */}
                  {searchResults.length > 0 && (
                    <div className="px-2 py-1 bg-green-900 border-b border-green-700 flex items-center justify-between">
                      <span className="text-green-200 text-xs">
                        {searchResults.length} results (green = matches)
                      </span>
                      <button
                        onClick={handleClearVectorSearch}
                        className="text-green-300 hover:text-white text-xs flex items-center gap-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Visualization and Results */}
                  <div className="flex-1 overflow-hidden p-2 flex flex-col min-h-0">
                    {loadingVectors ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-xs">Loading vectors...</p>
                      </div>
                    ) : vectorsResponse && vectorsResponse.vectors.length > 0 ? (
                      <div className="h-full flex flex-col gap-2 min-h-0">
                        {/* Top section: Visualization and Details */}
                        <div 
                          ref={resizeContainerRef}
                          className={`flex min-h-0 ${searchResults.length > 0 ? 'flex-1' : 'h-full max-h-[350px]'}`}
                        >
                          <div className="flex-1 min-h-0">
                            <VectorVisualization
                              vectors={vectorsResponse.vectors}
                              searchResults={searchResults}
                              queryVector={queryVector}
                              onVectorClick={setSelectedVector}
                              dimensions={vectorCollectionStats?.dimensions || 384}
                            />
                          </div>
                        
                          {/* Selected vector details with resize handle */}
                          {selectedVector && (
                          <>
                            {/* Resize handle */}
                            <div
                              onMouseDown={handleResizeStart}
                              className={`w-1.5 cursor-col-resize hover:bg-purple-500 transition-colors flex-shrink-0 ${
                                isResizing ? 'bg-purple-500' : 'bg-gray-700'
                              }`}
                              title="Drag to resize"
                            />
                            <div 
                              style={{ width: detailsPanelWidth }}
                              className="bg-gray-800 rounded-r p-2 overflow-y-auto text-xs flex-shrink-0"
                            >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-xs flex items-center gap-1">
                                <Info className="w-3 h-3 text-purple-400" />
                                Details
                              </h3>
                              <button
                                onClick={() => setSelectedVector(null)}
                                className="text-gray-400 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div>
                                <span className="text-gray-400">ID:</span>
                                <span className="ml-1 font-mono">{selectedVector.id}</span>
                              </div>
                              
                              {selectedVector.metadata?.text_preview && (
                                <div>
                                  <span className="text-gray-400">Text:</span>
                                  <p className="mt-0.5 text-gray-300 bg-gray-700 rounded p-1 text-[10px]">
                                    {selectedVector.metadata.text_preview}
                                  </p>
                                </div>
                              )}
                              
                              {selectedVector.metadata && Object.keys(selectedVector.metadata).length > 0 && (
                                <div>
                                  <span className="text-gray-400">Metadata:</span>
                                  <pre className="mt-0.5 text-gray-300 bg-gray-700 rounded p-1 text-[10px] overflow-x-auto max-h-20">
                                    {JSON.stringify(selectedVector.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {selectedVector.vector && (
                                <div>
                                  <span className="text-gray-400">
                                    Vector ({selectedVector.vector.length}D):
                                  </span>
                                  <pre className="mt-0.5 text-gray-300 bg-gray-700 rounded p-1 text-[10px] max-h-16 overflow-auto">
                                    [{selectedVector.vector.slice(0, 10).map((x: number) => x.toFixed(4)).join(', ')}
                                    {selectedVector.vector.length > 10 ? ', ...' : ''}]
                                  </pre>
                                </div>
                              )}
                              
                              <button
                                onClick={() => {
                                  if (confirm('Delete this vector?')) {
                                    deleteVectorMutation.mutate(selectedVector.id)
                                  }
                                }}
                                className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                          </>
                        )}
                        </div>

                        {/* Search Results Panel */}
                        {searchResults.length > 0 && (
                          <div className="h-1/2 bg-gray-800 rounded overflow-hidden flex flex-col">
                            <div className="px-2 py-1.5 bg-green-900 border-b border-green-700 flex items-center justify-between">
                              <h3 className="font-semibold text-green-200 text-xs flex items-center gap-1">
                                <Search className="w-3 h-3" />
                                Results ({searchResults.length})
                              </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-750 sticky top-0">
                                  <tr className="text-left text-[10px] text-gray-400 border-b border-gray-700">
                                    <th className="px-2 py-1 w-10">#</th>
                                    <th className="px-2 py-1 w-12">ID</th>
                                    <th className="px-2 py-1 w-16">Score</th>
                                    <th className="px-2 py-1">Metadata / Preview</th>
                                    <th className="px-2 py-1 w-12"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchResults.map((result, index) => (
                                    <tr 
                                      key={result.id}
                                      className={`border-b border-gray-700 hover:bg-gray-750 cursor-pointer ${
                                        selectedVector?.id === result.id ? 'bg-purple-900/30' : ''
                                      }`}
                                      onClick={() => setSelectedVector({
                                        id: result.id,
                                        vector: result.vector,
                                        metadata: result.metadata,
                                        created_at: 0
                                      })}
                                    >
                                      <td className="px-2 py-1.5">
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                          index === 0 ? 'bg-yellow-500 text-black' :
                                          index === 1 ? 'bg-gray-400 text-black' :
                                          index === 2 ? 'bg-orange-600 text-white' :
                                          'bg-gray-600 text-white'
                                        }`}>
                                          {index + 1}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 font-mono text-[10px] text-gray-300">
                                        {result.id}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <span className={`font-mono text-[10px] ${
                                          result.score >= 0.9 ? 'text-green-400' :
                                          result.score >= 0.7 ? 'text-yellow-400' :
                                          'text-gray-400'
                                        }`}>
                                          {result.score.toFixed(3)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 text-[10px] text-gray-300 max-w-xs truncate">
                                        {result.metadata?.text_preview ? (
                                          <span className="text-gray-300">{result.metadata.text_preview}</span>
                                        ) : result.metadata?.label ? (
                                          <span className="text-purple-300">{result.metadata.label}</span>
                                        ) : result.metadata?.source ? (
                                          <span className="text-blue-300">{result.metadata.source}</span>
                                        ) : result.metadata ? (
                                          <span className="text-gray-400">
                                            {JSON.stringify(result.metadata).slice(0, 30)}...
                                          </span>
                                        ) : (
                                          <span className="text-gray-500 italic">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedVector({
                                              id: result.id,
                                              vector: result.vector,
                                              metadata: result.metadata,
                                              created_at: 0
                                            })
                                          }}
                                          className="text-purple-400 hover:text-purple-300 text-[10px]"
                                        >
                                          View
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Box className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                          <p className="text-gray-400 text-xs">No vectors in this collection</p>
                          <div className="flex gap-1 justify-center mt-2">
                            <button
                              onClick={() => setShowUploadDialog(true)}
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              Upload
                            </button>
                            <button
                              onClick={() => setShowInsertVectorDialog(true)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition"
                            >
                              Insert
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Box className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-400 text-xs">Select a vector collection</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Document Collection Dialog */}
      {showNewCollectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-sm">
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="font-semibold text-sm">Create New Collection</h3>
            </div>
            <div className="p-3">
              <label className="block text-xs font-medium mb-1">
                Collection Name
              </label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateCollection()}
                placeholder="e.g., users, posts, products"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => {
                  setShowNewCollectionDialog(false)
                  setNewCollectionName('')
                }}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {selectedDocument ? 'Edit Document' : 'New Document'}
              </h3>
              <button
                onClick={() => setShowEditor(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="400px"
                defaultLanguage="json"
                value={editorValue}
                onChange={(value) => setEditorValue(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                }}
              />
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => setShowEditor(false)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Vector Collection Dialog */}
      {showNewVectorCollectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-sm">
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="font-semibold text-sm">Create Vector Collection</h3>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="block text-xs font-medium mb-1">Collection Name</label>
                <input
                  type="text"
                  value={newVectorCollectionName}
                  onChange={(e) => setNewVectorCollectionName(e.target.value)}
                  placeholder="e.g., embeddings, documents"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Dimensions</label>
                <input
                  type="number"
                  value={newVectorCollectionDimensions}
                  onChange={(e) => setNewVectorCollectionDimensions(parseInt(e.target.value) || 384)}
                  min={1}
                  max={4096}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">384 (MiniLM), 768 (BERT), 1536 (OpenAI)</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Distance Metric</label>
                <select
                  value={newVectorCollectionDistance}
                  onChange={(e) => setNewVectorCollectionDistance(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="cosine">Cosine (recommended for text)</option>
                  <option value="euclidean">Euclidean</option>
                  <option value="dot_product">Dot Product</option>
                </select>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => {
                  setShowNewVectorCollectionDialog(false)
                  setNewVectorCollectionName('')
                }}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => createVectorCollectionMutation.mutate()}
                disabled={!newVectorCollectionName.trim()}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Vector Dialog */}
      {showInsertVectorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-xl max-h-[80vh] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Insert Vector</h3>
              <button onClick={() => setShowInsertVectorDialog(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3">
              <p className="text-xs text-gray-400 mb-1">
                Enter vector array or object with "vector" and "metadata":
              </p>
              <Editor
                height="250px"
                defaultLanguage="json"
                value={insertVectorJson}
                onChange={(value) => setInsertVectorJson(value || '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 12 }}
              />
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => setShowInsertVectorDialog(false)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertVector}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Vector Dialog */}
      {showSearchVectorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-xl max-h-[80vh] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Vector Search</h3>
              <button onClick={() => setShowSearchVectorDialog(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3 space-y-2">
              {/* Search Mode Toggle */}
              <div className="flex gap-1">
                <button
                  onClick={() => setSearchMode('text')}
                  className={`flex-1 py-1 rounded text-xs transition ${
                    searchMode === 'text' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setSearchMode('vector')}
                  className={`flex-1 py-1 rounded text-xs transition ${
                    searchMode === 'vector' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Vector
                </button>
              </div>

              {searchMode === 'text' ? (
                <div>
                  <label className="block text-xs font-medium mb-1">Search Text</label>
                  <textarea
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Enter text to find similar vectors..."
                    className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Text converted to vector via TF-IDF
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium">Query Vector</label>
                    <button
                      onClick={handleGenerateRandomVector}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      Random
                    </button>
                  </div>
                  <Editor
                    height="150px"
                    defaultLanguage="json"
                    value={searchVectorJson}
                    onChange={(value) => setSearchVectorJson(value || '')}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 12 }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Top K</label>
                <input
                  type="number"
                  value={searchK}
                  onChange={(e) => setSearchK(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => setShowSearchVectorDialog(false)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleVectorSearch}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition flex items-center gap-1"
              >
                <Search className="w-3 h-3" />
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Files Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Upload Files</h3>
              <button onClick={() => { setShowUploadDialog(false); setUploadedFiles([]) }} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {/* File input */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded p-4 text-center cursor-pointer hover:border-purple-500 transition"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400 text-xs">Click to select files</p>
                <p className="text-[10px] text-gray-500 mt-1">PDF, DOCX, Excel, Code, Text files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_STRING}
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Selected files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium">Files ({uploadedFiles.length})</h4>
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-gray-700 rounded px-2 py-1">
                      <FileText className="w-3 h-3 text-purple-400" />
                      <span className="flex-1 truncate text-xs">{file.name}</span>
                      <span className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)}K</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Chunk size */}
              <div>
                <label className="block text-xs font-medium mb-1">Chunk Size</label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value) || 500)}
                  min={100}
                  max={5000}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <span className="text-[10px] text-gray-400 ml-1">chars</span>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-1">
              <button
                onClick={() => { setShowUploadDialog(false); setUploadedFiles([]) }}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessFiles}
                disabled={uploadedFiles.length === 0 || isProcessingFiles}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition flex items-center gap-1 disabled:opacity-50"
              >
                {isProcessingFiles ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Convert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
