/**
 * File Upload Module of Web Application
 * 
 * Handles file input, drag-and-drop functionality, file validation,
 * and Excel file parsing using SheetJS.
 */

class FileUploadManager {
    constructor(options = {}) {
        this.options = options;
        this.dropZone = null;
        this.fileInput = null;
        this.selectFileBtn = null;
        this.isProcessing = false;
        
        this.init();
    }
    
    init() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFileBtn = document.getElementById('selectFileBtn');
        
        if (!this.dropZone || !this.fileInput) {
            throw new Error('File upload elements not found in DOM');
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const openFileDialog = () => {
            if (this.isProcessing) return;
            // Reset so selecting the same file again still triggers `change`.
            this.fileInput.value = '';
            this.fileInput.click();
        };

        // File input change event
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });
        
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });
        
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // Dedicated select button (prevents duplicate bubbling click behavior)
        if (this.selectFileBtn) {
            this.selectFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openFileDialog();
            });
        }

        // Click anywhere on drop zone to upload (except button which handles itself)
        this.dropZone.addEventListener('click', (e) => {
            if (e.target && e.target.closest && e.target.closest('#selectFileBtn')) {
                return;
            }
            openFileDialog();
        });
    }
    
    async handleFile(file) {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                this.showError(validation.error);
                this.isProcessing = false;
                return;
            }
            
            // Notify file selected
            if (this.options.onFileSelected) {
                this.options.onFileSelected(file);
            }
            
            // Show progress
            this.showProgress(0);
            
            // Parse file
            const data = await this.parseExcelFile(file);
            
            // Notify file parsed
            if (this.options.onFileParsed) {
                this.options.onFileParsed(data);
            }
            
            this.showProgress(100);
            this.hideProgress();
            
        } catch (error) {
            this.showError(error.message);
            if (this.options.onError) {
                this.options.onError(error);
            }
        } finally {
            this.isProcessing = false;
            this.fileInput.value = '';
        }
    }
    
    validateFile(file) {
        // Check file type (MIME + extension fallback)
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        const lowerName = (file.name || '').toLowerCase();
        const hasValidExtension = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
        const hasValidMime = allowedTypes.includes(file.type);

        if (!hasValidMime && !hasValidExtension) {
            return { isValid: false, error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' };
        }
        
        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return { isValid: false, error: 'File too large. Maximum file size is 50MB' };
        }
        
        return { isValid: true };
    }
    
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Get first worksheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,
                        defval: null
                    });
                    
                    // Convert to array of objects
                    const result = this.convertToObjects(jsonData);
                    
                    resolve(result);
                } catch (error) {
                    reject(new Error('Failed to parse Excel file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    convertToObjects(jsonData) {
        if (jsonData.length === 0) {
            return [];
        }
        
        // First row contains headers
        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        
        // Clean headers (remove empty headers and create unique names)
        const cleanHeaders = headers.map((header, index) => {
            if (!header || header === '') {
                return `Column_${index + 1}`;
            }
            return header.toString().trim();
        });
        
        // Create unique column names if duplicates exist
        const uniqueHeaders = this.makeUniqueHeaders(cleanHeaders);
        
        // Convert rows to objects
        return rows.map(row => {
            const obj = {};
            uniqueHeaders.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });
    }
    
    makeUniqueHeaders(headers) {
        const seen = {};
        return headers.map(header => {
            if (seen[header]) {
                const newHeader = `${header}_${seen[header]}`;
                seen[header]++;
                return newHeader;
            } else {
                seen[header] = 1;
                return header;
            }
        });
    }
    
    showProgress(percentage) {
        const progressEl = document.getElementById('uploadProgress');
        const progressBarEl = progressEl ? progressEl.querySelector('.progress-bar') : null;
        
        if (progressEl) {
            progressEl.style.display = 'block';
        }
        
        if (progressBarEl) {
            progressBarEl.style.width = `${percentage}%`;
            progressBarEl.textContent = `${percentage}%`;
        }
    }
    
    hideProgress() {
        const progressEl = document.getElementById('uploadProgress');
        if (progressEl) {
            progressEl.style.display = 'none';
        }
    }
    
    showError(message) {
        const statusEl = document.getElementById('uploadStatus');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <strong>Error:</strong> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    }
    
    clearError() {
        const statusEl = document.getElementById('uploadStatus');
        if (statusEl) {
            statusEl.innerHTML = '';
        }
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileUploadManager;
} else {
    window.FileUploadManager = FileUploadManager;
}