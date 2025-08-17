# 🔧 Construction Inventory Extractor

AI-powered tool to extract inventory data from Excel/PDF files using Azure Document Intelligence.

## 🎯 Features

- **Smart Field Detection**: Works with any Excel format - automatically maps columns
- **Azure AI Integration**: Uses Azure Document Intelligence for accurate table extraction
- **Flexible Input**: Supports PDF, CSV, Excel (converted), and images
- **Construction-Focused**: Pre-configured categories for construction equipment
- **Summary Tables**: Clean results display with confidence scoring
- **Secure**: Environment variables for API keys

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Azure Document Intelligence resource (free tier available)

### 2. Clone & Install
```bash
git clone <your-repo-url>
cd construction-inventory-extractor
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_KEY=your-azure-api-key
PORT=3000
```

### 4. Run the Application
```bash
npm start
# or
node server.js
```

Visit: `http://localhost:3000`

## 🔑 Getting Azure Credentials

1. **Create Azure Account**: Go to [portal.azure.com](https://portal.azure.com)
2. **Create Form Recognizer Resource**: 
   - Search "Form Recognizer" or "Document Intelligence"
   - Create new resource
   - Choose free tier (F0) for testing
3. **Get Credentials**:
   - Go to your resource → "Keys and Endpoint"
   - Copy Endpoint URL and Key 1
   - Add to your `.env` file

## 📊 Target Fields

The system extracts data and maps it to these webapp fields:

### Required Fields
- **Project**: Work site or project name
- **Item Name**: Tool/equipment description
- **Category**: Auto-categorized equipment type

### Optional Fields
- **Condition**: Item condition (defaults to 'Good')
- **Purchase Date**: When item was acquired
- **Description**: Additional specifications

## 📁 Supported File Formats

| Format | Support | Notes |
|--------|---------|-------|
| PDF | ✅ **Recommended** | Best accuracy and table detection |
| CSV | ✅ **Supported** | Direct processing, high accuracy |
| PNG/JPG | ✅ **Supported** | For Excel screenshots |
| Excel (.xlsx/.xls) | ⚠️ **Convert First** | Convert to PDF for best results |

## 🏗️ Construction Categories

Auto-categorizes items into:
- **Power Tools**: Drills, grinders, saws, hammers
- **Safety Equipment**: Helmets, harnesses, signals
- **Hand Tools**: Wrenches, screwdrivers, shovels
- **Measuring Tools**: Levels, rulers, gauges
- **Power Equipment**: Generators, compressors
- **Construction Materials**: Pipes, wires, beams

## 🔧 Development

### Project Structure
```
construction-inventory-extractor/
├── server.js           # Main application
├── package.json        # Dependencies
├── .env               # Environment variables (not in git)
├── .gitignore         # Git ignore rules
├── README.md          # This file
└── node_modules/      # Dependencies (not in git)
```

### Adding New Categories
Edit the `categorizeItem()` function in `server.js`:
```javascript
const categories = {
  'Your New Category': ['keyword1', 'keyword2', 'keyword3']
};
```

### Environment Variables
- `AZURE_ENDPOINT`: Your Azure Document Intelligence endpoint
- `AZURE_KEY`: Your Azure API key
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## 🚢 Deployment

### Deploy to Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set AZURE_ENDPOINT=your-endpoint
heroku config:set AZURE_KEY=your-key

# Deploy
git push heroku main
```

### Deploy to Azure App Service
```bash
# Install Azure CLI
az login

# Create resource group and app service
az group create --name inventory-extractor --location "East US"
az appservice plan create --name inventory-plan --resource-group inventory-extractor --sku F1
az webapp create --name your-app-name --resource-group inventory-extractor --plan inventory-plan

# Set environment variables
az webapp config appsettings set --name your-app-name --resource-group inventory-extractor --settings AZURE_ENDPOINT=your-endpoint AZURE_KEY=your-key

# Deploy
az webapp deployment source config-local-git --name your-app-name --resource-group inventory-extractor
git remote add azure <git-clone-url>
git push azure main
```

## 🔒 Security Best Practices

- ✅ **Environment Variables**: API keys stored in `.env` (not committed)
- ✅ **Gitignore**: Sensitive files excluded from Git
- ✅ **Input Validation**: File type and size validation
- ✅ **Error Handling**: Graceful error messages without exposing internals

## 🐛 Troubleshooting

### Common Issues

**"Invalid Azure credentials"**
- Check your `.env` file exists and has correct values
- Verify your Azure resource is active
- Ensure your API key hasn't expired

**"Excel format not supported"**
- Convert Excel to PDF: File → Save As → PDF
- Or save as CSV for simple tables

**"No tables found"**
- Ensure your document has clear table structure
- Try improving image quality if using screenshots
- Check that headers are in the first row

**"Low confidence scores"**
- Use clearer column headers
- Ensure text is readable (not blurry/handwritten)
- Try converting to PDF for better OCR

## 📝 API Endpoints

- `GET /` - Main web interface
- `POST /extract-inventory` - Process uploaded file
- `GET /test-azure` - Test Azure connection
- `GET /health` - Health check

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit: `git commit -m 'Add some feature'`
5. Push: `git push origin feature-name`
6. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Look at the browser console for error messages
3. Check server logs for detailed error information
4. Create an issue on GitHub with:
   - Error message
   - File type you're trying to process
   - Browser and OS information

## 🔗 Useful Links

- [Azure Document Intelligence Documentation](https://docs.microsoft.com/en-us/azure/applied-ai-services/form-recognizer/)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [Express.js Documentation](https://expressjs.com/)