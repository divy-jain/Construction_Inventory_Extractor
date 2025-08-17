// server.js - Secure version with environment variables
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Get Azure credentials from environment variables
const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
const AZURE_KEY = process.env.AZURE_KEY;
const PORT = process.env.PORT || 3000;

// Validate required environment variables
if (!AZURE_ENDPOINT || !AZURE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   AZURE_ENDPOINT:', AZURE_ENDPOINT ? '✅ Set' : '❌ Missing');
  console.error('   AZURE_KEY:', AZURE_KEY ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('📋 Please create a .env file with:');
  console.error('   AZURE_ENDPOINT=your_azure_endpoint');
  console.error('   AZURE_KEY=your_azure_key');
  process.exit(1);
}

const client = new DocumentAnalysisClient(AZURE_ENDPOINT, new AzureKeyCredential(AZURE_KEY));

// YOUR WEBAPP'S TARGET FIELDS (from your original requirements)
const TARGET_FIELDS = {
  // Required fields
  project: 'Project name or work site',
  itemName: 'Tool/equipment name or description', 
  category: 'Equipment category (auto-assigned)',
  
  // Optional fields
  condition: 'Current condition (defaults to Good)',
  purchaseDate: 'Date purchased (YYYY-MM-DD format)',
  description: 'Additional details and specifications'
};

// Flexible field detection - works with ANY Excel format
function detectFieldMappings(headers) {
  const mappings = {};
  const normalizedHeaders = headers.map(h => 
    h.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '')
  );
  
  // Broad patterns for flexible detection
  const fieldPatterns = {
    // Item name - most important field
    itemName: [
      'nombre', 'item', 'descripcion', 'description', 'herramienta', 'tool', 
      'equipment', 'producto', 'product', 'material', 'articulo', 'name'
    ],
    
    // Purchase date - flexible date detection
    purchaseDate: [
      'fecha', 'date', 'compra', 'purchase', 'año', 'year', 'adquisicion',
      'fechacompra', 'purchasedate', 'bought', 'acquired'
    ],
    
    // Condition
    condition: [
      'condicion', 'condition', 'estado', 'state', 'status', 'situacion'
    ],
    
    // Fields that help build description
    brand: ['marca', 'brand', 'fabricante', 'manufacturer'],
    model: ['modelo', 'model', 'tipo', 'type'],
    serialNumber: ['serie', 'serial', 'numero', 'nserie', 'serialnumber'],
    specifications: ['caracteristicas', 'specs', 'specifications', 'features', 'detalles'],
    supplier: ['proveedor', 'supplier', 'vendor'],
    quantity: ['cant', 'cantidad', 'qty', 'quantity', 'unidades', 'units']
  };
  
  Object.entries(fieldPatterns).forEach(([field, patterns]) => {
    normalizedHeaders.forEach((header, index) => {
      if (patterns.some(pattern => 
        header.includes(pattern) || pattern.includes(header)
      )) {
        if (!mappings[field]) {
          mappings[field] = index;
        }
      }
    });
  });
  
  return mappings;
}

// Smart category assignment for construction inventory
function categorizeItem(itemName) {
  const name = (itemName || '').toLowerCase();
  
  const categories = {
    'Power Tools': [
      'taladro', 'martillo', 'radial', 'amoladora', 'batidora', 'sierra',
      'drill', 'hammer', 'grinder', 'mixer', 'saw', 'cutter'
    ],
    'Safety Equipment': [
      'arnes', 'casco', 'safety', 'protective', 'proteccion', 'señal',
      'helmet', 'harness', 'signal', 'warning', 'guard'
    ],
    'Hand Tools': [
      'llave', 'destornillador', 'pala', 'martillo', 'cincel',
      'wrench', 'screwdriver', 'shovel', 'chisel', 'pliers'
    ],
    'Measuring Tools': [
      'metro', 'nivel', 'regla', 'medidor',
      'measure', 'level', 'ruler', 'gauge'
    ],
    'Power Equipment': [
      'grupo', 'generador', 'compresor', 'motor',
      'generator', 'compressor', 'engine', 'power'
    ],
    'Construction Materials': [
      'cable', 'tubo', 'material', 'alambre',
      'pipe', 'wire', 'beam', 'rod'
    ]
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }
  
  return 'General Equipment';
}

// Flexible date parsing
function formatPurchaseDate(dateValue) {
  if (!dateValue) return null;
  
  const dateStr = dateValue.toString().trim();
  
  // Try various date formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,    // MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,     // MM-DD-YYYY  
    /(\d{4})-(\d{1,2})-(\d{1,2})/,     // YYYY-MM-DD
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,   // YYYY/MM/DD
    /(\d{4})/                          // Just year
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern === patterns[4]) { // Just year
        const year = parseInt(match[1]);
        if (year > 1900 && year <= new Date().getFullYear() + 5) {
          return `${year}-01-01`;
        }
      } else if (pattern === patterns[2] || pattern === patterns[3]) { // Already YYYY-MM-DD format
        return dateStr;
      } else { // MM/DD/YYYY format - convert to YYYY-MM-DD
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  return null;
}

// Build description from available fields
function buildDescription(row, mappings, headers) {
  const parts = [];
  
  const descriptionFields = ['brand', 'model', 'serialNumber', 'specifications', 'supplier', 'quantity'];
  
  descriptionFields.forEach(field => {
    const value = getFieldValue(row, mappings[field]);
    if (value && value.trim()) {
      const fieldName = headers[mappings[field]] || field;
      parts.push(`${fieldName}: ${value}`);
    }
  });
  
  return parts.join(' | ') || 'No additional details available';
}

function getFieldValue(row, index) {
  return index !== undefined ? (row[index] || '').toString().trim() : '';
}

// Demo Frontend with Results Table
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🚀 Construction Inventory Extractor</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 15px; 
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .content { padding: 40px; }
            .target-fields {
                background: #e3f2fd;
                border: 1px solid #90caf9;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
            }
            .upload-area {
                border: 3px dashed #ccc;
                border-radius: 15px;
                padding: 40px;
                text-align: center;
                margin: 30px 0;
                transition: all 0.3s ease;
                background: #f8f9fa;
            }
            .btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 18px;
                margin: 10px;
            }
            .results { margin-top: 30px; display: none; }
            .item-card {
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 15px 0;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .summary-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 30px;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .summary-table th, .summary-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            .summary-table th {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-weight: bold;
            }
            .summary-table tr:hover {
                background: #f8f9fa;
            }
            .confidence {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }
            .confidence.high { background: #d4edda; color: #155724; }
            .confidence.medium { background: #fff3cd; color: #856404; }
            .confidence.low { background: #f8d7da; color: #721c24; }
            .loading { display: none; text-align: center; padding: 30px; }
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            .stat-card {
                text-align: center;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border: 1px solid #ddd;
            }
            .stat-number {
                font-size: 2em;
                font-weight: bold;
                color: #667eea;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔧 Construction Inventory Extractor</h1>
                <p>AI-powered tool to extract inventory data from any Excel format</p>
            </div>
            
            <div class="content">
                <div class="target-fields">
                    <h3>🎯 Target Fields for Your Web App</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                        <div>
                            <h4>Required Fields:</h4>
                            <ul>
                                <li><strong>Project:</strong> Work site or project name</li>
                                <li><strong>Item Name:</strong> Tool/equipment description</li>
                                <li><strong>Category:</strong> Auto-categorized equipment type</li>
                            </ul>
                        </div>
                        <div>
                            <h4>Optional Fields:</h4>
                            <ul>
                                <li><strong>Condition:</strong> Item condition (defaults to 'Good')</li>
                                <li><strong>Purchase Date:</strong> When item was acquired</li>
                                <li><strong>Description:</strong> Additional specifications</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="upload-area" id="uploadArea">
                    <h3>📁 Upload Your Excel/PDF File</h3>
                    <p>Works with any Excel format - flexible field detection</p>
                    <input type="file" id="fileInput" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg" style="display: none;">
                    <button class="btn" onclick="document.getElementById('fileInput').click()">
                        📤 Choose File
                    </button>
                    <p style="margin-top: 15px; color: #666;">
                        <strong>Supported:</strong> PDF (recommended), CSV, Excel, Images
                    </p>
                </div>

                <div style="text-align: center;">
                    <button id="processBtn" class="btn" onclick="processFile()" disabled>
                        🤖 Extract Inventory Data
                    </button>
                </div>

                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    <h3>Processing with Azure AI...</h3>
                    <p>Analyzing document and mapping to your webapp fields...</p>
                </div>

                <div class="results" id="results">
                    <h3>📊 Extraction Results</h3>
                    <div class="stats-grid" id="stats"></div>
                    
                    <h4>📋 Individual Items</h4>
                    <div id="itemsList"></div>
                    
                    <h4>📈 Summary Table</h4>
                    <table class="summary-table" id="summaryTable">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Project</th>
                                <th>Purchase Date</th>
                                <th>Condition</th>
                                <th>Confidence</th>
                            </tr>
                        </thead>
                        <tbody id="tableBody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script>
            let selectedFile = null;

            document.getElementById('fileInput').addEventListener('change', function(e) {
                selectedFile = e.target.files[0];
                if (selectedFile) {
                    document.getElementById('uploadArea').innerHTML = \`
                        <h3>✅ File Selected</h3>
                        <p><strong>\${selectedFile.name}</strong></p>
                        <p>Size: \${(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button class="btn" onclick="document.getElementById('fileInput').click()">
                            📁 Choose Different File
                        </button>
                    \`;
                    document.getElementById('processBtn').disabled = false;
                }
            });

            async function processFile() {
                if (!selectedFile) return;

                document.getElementById('loading').style.display = 'block';
                document.getElementById('results').style.display = 'none';

                const formData = new FormData();
                formData.append('file', selectedFile);

                try {
                    const response = await fetch('/extract-inventory', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    
                    document.getElementById('loading').style.display = 'none';

                    if (result.success) {
                        displayResults(result);
                    } else {
                        displayError(result);
                    }

                } catch (error) {
                    document.getElementById('loading').style.display = 'none';
                    displayError({ error: 'Network error', details: error.message });
                }
            }

            function displayResults(result) {
                // Stats
                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-number">\${result.totalItems}</div>
                        <div>Items Extracted</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${result.processingInfo.tablesDetected}</div>
                        <div>Tables Found</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${Math.round(result.processingInfo.confidenceScore)}%</div>
                        <div>Avg Confidence</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${new Set(result.extractedItems.map(i => i.category)).size}</div>
                        <div>Categories</div>
                    </div>
                \`;

                // Individual items
                let itemsHtml = '';
                result.extractedItems.forEach((item, index) => {
                    const confidenceClass = item.confidence >= 90 ? 'high' : 
                                          item.confidence >= 70 ? 'medium' : 'low';
                    
                    itemsHtml += \`
                        <div class="item-card">
                            <h4>\${item.itemName || 'Unnamed Item'} 
                                <span class="confidence \${confidenceClass}">\${item.confidence}%</span>
                            </h4>
                            <p><strong>Category:</strong> \${item.category}</p>
                            <p><strong>Project:</strong> \${item.project}</p>
                            <p><strong>Condition:</strong> \${item.condition}</p>
                            <p><strong>Purchase Date:</strong> \${item.purchaseDate || 'Not specified'}</p>
                            <p><strong>Description:</strong> \${item.description}</p>
                        </div>
                    \`;
                });

                // Summary table
                let tableHtml = '';
                result.extractedItems.forEach(item => {
                    const confidenceClass = item.confidence >= 90 ? 'high' : 
                                          item.confidence >= 70 ? 'medium' : 'low';
                    
                    tableHtml += \`
                        <tr>
                            <td>\${item.itemName}</td>
                            <td>\${item.category}</td>
                            <td>\${item.project}</td>
                            <td>\${item.purchaseDate || 'Not specified'}</td>
                            <td>\${item.condition}</td>
                            <td><span class="confidence \${confidenceClass}">\${item.confidence}%</span></td>
                        </tr>
                    \`;
                });

                document.getElementById('itemsList').innerHTML = itemsHtml;
                document.getElementById('tableBody').innerHTML = tableHtml;
                document.getElementById('results').style.display = 'block';
            }

            function displayError(result) {
                document.getElementById('results').innerHTML = \`
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 20px; border-radius: 8px;">
                        <h3>❌ Processing Error</h3>
                        <p><strong>Error:</strong> \${result.error}</p>
                        <p><strong>Details:</strong> \${result.details}</p>
                        \${result.solution ? \`<p><strong>Solution:</strong> \${result.solution}</p>\` : ''}
                    </div>
                \`;
                document.getElementById('results').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

// Main processing endpoint
app.post('/extract-inventory', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📄 Processing: ${req.file.originalname} (${req.file.size} bytes)`);

    // Check if Excel file (not supported directly)
    if (req.file.originalname.match(/\.(xlsx|xls)$/i)) {
      return res.status(400).json({
        error: 'Excel format requires conversion',
        details: 'Please convert Excel to PDF for best results',
        solution: 'Open Excel → File → Save As → PDF'
      });
    }

    // Process with Azure
    const poller = await client.beginAnalyzeDocument("prebuilt-layout", req.file.buffer);
    console.log('⏳ Analyzing with Azure AI...');
    const result = await poller.pollUntilDone();
    console.log('✅ Analysis complete!');

    // Extract project name from filename
    const projectName = req.file.originalname
      .replace(/\.(pdf|csv|png|jpg|jpeg)$/i, '')
      .replace(/[-_]/g, ' ')
      .toUpperCase();

    const tables = result.tables || [];
    const extractedItems = [];
    let totalConfidence = 0;

    if (tables.length > 0) {
      console.log(`📊 Found ${tables.length} table(s)`);
      
      const mainTable = tables[0]; // Process first/largest table
      const tableData = processAzureTable(mainTable);
      
      if (tableData.headers.length > 0 && tableData.rows.length > 0) {
        const fieldMappings = detectFieldMappings(tableData.headers);
        console.log('🔍 Field mappings:', fieldMappings);
        
        tableData.rows.forEach((row, index) => {
          if (row.some(cell => cell.trim())) {
            const itemName = getFieldValue(row, fieldMappings.itemName) || `Item ${index + 1}`;
            const confidence = calculateItemConfidence(row, fieldMappings);
            totalConfidence += confidence;
            
            // Map to YOUR webapp fields
            const item = {
              id: `azure_${index}`,
              project: projectName,
              itemName: itemName.trim(),
              category: categorizeItem(itemName),
              condition: getFieldValue(row, fieldMappings.condition) || 'Good',
              purchaseDate: formatPurchaseDate(getFieldValue(row, fieldMappings.purchaseDate)),
              description: buildDescription(row, fieldMappings, tableData.headers),
              confidence: confidence,
              validationIssues: validateItem(row, fieldMappings),
              source: 'azure_ai'
            };
            
            extractedItems.push(item);
          }
        });
      }
    }

    const avgConfidence = extractedItems.length > 0 ? Math.round(totalConfidence / extractedItems.length) : 0;

    res.json({
      success: true,
      extractedItems,
      totalItems: extractedItems.length,
      projectName,
      processingInfo: {
        service: 'Azure Document Intelligence',
        tablesDetected: tables.length,
        confidenceScore: avgConfidence,
        targetFields: Object.keys(TARGET_FIELDS),
        fieldMappingSuccess: extractedItems.length > 0
      }
    });

  } catch (error) {
    console.error('❌ Processing error:', error);
    res.status(500).json({
      error: 'Processing failed',
      details: error.message,
      solution: 'Try converting to PDF or check file format'
    });
  }
});

// Helper functions
function processAzureTable(table) {
  const cellMap = {};
  table.cells.forEach(cell => {
    cellMap[`${cell.rowIndex}-${cell.columnIndex}`] = cell.content || '';
  });
  
  const maxRow = Math.max(...table.cells.map(c => c.rowIndex));
  const maxCol = Math.max(...table.cells.map(c => c.columnIndex));
  
  const headers = [];
  for (let col = 0; col <= maxCol; col++) {
    headers.push(cellMap[`0-${col}`] || '');
  }
  
  const rows = [];
  for (let row = 1; row <= maxRow; row++) {
    const rowData = [];
    for (let col = 0; col <= maxCol; col++) {
      rowData.push(cellMap[`${row}-${col}`] || '');
    }
    rows.push(rowData);
  }
  
  return { headers, rows };
}

function calculateItemConfidence(row, mappings) {
  let score = 0;
  if (getFieldValue(row, mappings.itemName)) score += 50;
  if (getFieldValue(row, mappings.brand)) score += 15;
  if (getFieldValue(row, mappings.model)) score += 15;
  if (getFieldValue(row, mappings.purchaseDate)) score += 10;
  if (getFieldValue(row, mappings.specifications)) score += 10;
  return Math.min(score, 100);
}

function validateItem(row, mappings) {
  const issues = [];
  if (!getFieldValue(row, mappings.itemName)) {
    issues.push({
      field: 'itemName',
      message: 'Item name is required',
      severity: 'error'
    });
  }
  return issues;
}

// Test endpoint
app.get('/test-azure', async (req, res) => {
  res.json({
    status: 'Ready',
    endpoint: AZURE_ENDPOINT ? '✅ Configured' : '❌ Missing',
    apiKey: AZURE_KEY ? '✅ Configured' : '❌ Missing',
    targetFields: TARGET_FIELDS,
    supportedFormats: ['PDF', 'CSV', 'PNG', 'JPG']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Construction Inventory Extractor running on http://localhost:${PORT}`);
  console.log('🎯 Target webapp fields:', Object.keys(TARGET_FIELDS));
  console.log('🔒 Security: Environment variables loaded');
  console.log('📊 Features: Flexible field detection + Summary table');
});