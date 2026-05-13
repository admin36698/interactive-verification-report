const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
let pdfParse = null;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.log('pdf-parse not available, PDF parsing will be limited');
}

class FileProcessor {
    static async processFile(filePath, originalName = null) {
        let ext = path.extname(filePath).toLowerCase();
        
        if (!ext && originalName) {
            ext = path.extname(originalName).toLowerCase();
        }
        
        switch (ext) {
            case '.zip':
                return await this.processZip(filePath);
            case '.pdf':
                return await this.processPdf(filePath);
            case '.json':
                return await this.processJson(filePath);
            case '.txt':
            case '.data':
                return await this.processText(filePath);
            default:
                return await this.processBinary(filePath);
        }
    }

    static async processZip(filePath) {
        try {
            const entries = [];
            const zip = await unzipper.Open.file(filePath);
            
            for (const entry of zip.files) {
                if (entry.type !== 'File') continue;
                
                if (entry.uncompressedSize === 0) continue;
                
                const content = await entry.buffer();
                const ext = path.extname(entry.path).toLowerCase();
                
                entries.push({
                    name: entry.path,
                    size: entry.uncompressedSize,
                    type: ext || '.unknown',
                    content: content.toString('utf-8'),
                    isBinary: this.isBinary(content)
                });
            }
            
            return {
                type: 'zip',
                files: entries,
                totalFiles: entries.length
            };
        } catch (error) {
            return {
                type: 'zip',
                error: `Failed to parse ZIP file: ${error.message}`
            };
        }
    }

    static async processPdf(filePath) {
        try {
            const stats = fs.statSync(filePath);
            
            if (!pdfParse) {
                return {
                    type: 'pdf',
                    text: `PDF 文件 (${stats.size} bytes) - PDF 解析库未配置`,
                    numPages: 0,
                    info: { size: stats.size },
                    metadata: {},
                    note: 'PDF parsing requires additional configuration'
                };
            }
            
            const dataBuffer = fs.readFileSync(filePath);
            
            try {
                const { PDFParse, VerbosityLevel } = pdfParse;
                const parser = new PDFParse({ verbosity: VerbosityLevel.NONE });
                
                const pdfData = await new Promise((resolve, reject) => {
                    const proto = Object.getPrototypeOf(parser);
                    if (typeof parser.parse === 'function') {
                        parser.parse(dataBuffer).then(resolve).catch(reject);
                    } else if (typeof proto.parse === 'function') {
                        proto.parse.call(parser, dataBuffer).then(resolve).catch(reject);
                    } else {
                        reject(new Error('No parse method available'));
                    }
                });
                
                return {
                    type: 'pdf',
                    text: pdfData.text || '',
                    numPages: pdfData.numPages || pdfData.numpages || 0,
                    info: pdfData.info || {},
                    metadata: pdfData.metadata || {}
                };
            } catch (e) {
                return {
                    type: 'pdf',
                    text: `PDF 文件内容预览不可用 (${stats.size} bytes)`,
                    numPages: 0,
                    info: { size: stats.size, parseError: e.message },
                    metadata: {},
                    note: 'PDF parsing failed, showing basic file info'
                };
            }
        } catch (error) {
            return {
                type: 'pdf',
                error: `Failed to process PDF file: ${error.message}`,
                text: '',
                numPages: 0,
                info: {},
                metadata: {}
            };
        }
    }

    static async processJson(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            return {
                type: 'json',
                data: data,
                content: content
            };
        } catch (error) {
            return {
                type: 'json',
                error: `Failed to parse JSON file: ${error.message}`,
                content: fs.readFileSync(filePath, 'utf-8')
            };
        }
    }

    static async processText(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        return {
            type: 'text',
            content: content,
            length: content.length
        };
    }

    static async processBinary(filePath) {
        const stats = fs.statSync(filePath);
        
        return {
            type: 'binary',
            size: stats.size,
            extension: path.extname(filePath),
            hint: 'This is a binary file. Content not displayed.'
        };
    }

    static isBinary(buffer) {
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0) return true;
        }
        return false;
    }

    static getFileInfo(filePath) {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            extension: ext,
            mtime: stats.mtime.toISOString(),
            type: this.getFileType(ext)
        };
    }

    static getFileType(extension) {
        const types = {
            '.zip': 'compressed',
            '.pdf': 'document',
            '.json': 'data',
            '.txt': 'text',
            '.data': 'encrypted',
            '.xml': 'data',
            '.csv': 'data',
            '.md': 'text',
            '.html': 'document',
            '.js': 'code',
            '.css': 'code',
            '.png': 'image',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.gif': 'image'
        };
        
        return types[extension] || 'binary';
    }
}

module.exports = FileProcessor;