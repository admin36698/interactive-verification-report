const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const iconv = require('iconv-lite');

const { init_vrdaemon, close_vrdaemon, get_express_instance, process_verfication_report } = require('../src/VRDaemon.js');
const FileProcessor = require('../src/FileProcessor.js');

function decodeFilename(filename) {
  if (!filename) return filename;
  
  try {
    const decoded = decodeURIComponent(filename);
    if (decoded !== filename && /[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
  } catch (e) {}
  
  try {
    const utf8Buffer = Buffer.from(filename, 'utf-8');
    const rawString = utf8Buffer.toString('binary');
    const gbkResult = iconv.decode(Buffer.from(rawString, 'binary'), 'GBK');
    if (gbkResult !== filename && /[\u4e00-\u9fa5]/.test(gbkResult)) {
      return gbkResult;
    }
  } catch (e) {}
  
  try {
    const bytes = [];
    for (let i = 0; i < filename.length; i++) {
      bytes.push(filename.charCodeAt(i));
    }
    const result = iconv.decode(Buffer.from(bytes), 'GBK');
    if (result !== filename && /[\u4e00-\u9fa5]/.test(result)) {
      return result;
    }
  } catch (e) {}
  
  try {
    const buffer = Buffer.from(filename, 'latin1');
    const gbkDecoded = iconv.decode(buffer, 'GBK');
    if (gbkDecoded !== filename && /[\u4e00-\u9fa5]/.test(gbkDecoded)) {
      return gbkDecoded;
    }
  } catch (e) {}
  
  return filename;
}

class LocalMetaProvider {
  constructor(opts) {
    this.processorPath = opts.processorPath;
    this.interactorPath = opts.interactorPath;
    this.enclaveHash = opts.enclaveHash || 'abcd';
    this.privateKey = opts.privateKey;
  }
  async getDataProcessorCode(enclave_hash) {
    return fs.readFileSync(this.processorPath, 'utf-8');
  }
  async getInteractorCode(enclave_hash) {
    return fs.readFileSync(this.interactorPath, 'utf-8');
  }
  async getShuPrivateKey() {
    return this.privateKey;
  }
  async getEnclaveHash(request_hash) {
    return this.enclaveHash;
  }
}

const PORT = 5052;
const META_DIR = path.resolve(__dirname, '../data/meta');
const UPLOAD_DIR = path.resolve(__dirname, '../data/uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage_config = {
  db: { name: 'sqlite3', filename: path.join(__dirname, 'example.db') },
  cdn: {},
  data_dir: __dirname,
};

const meta_provider = new LocalMetaProvider({
  processorPath: path.resolve(__dirname, '../test/simple/VRDataProcessor.js'),
  interactorPath: path.resolve(__dirname, './code/abcd_interactor.js'),
  enclaveHash: 'abcd',
  privateKey: '60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8',
});

init_vrdaemon(meta_provider, PORT, storage_config, META_DIR);

const app = get_express_instance();
app.use('/', express.static(__dirname));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = decodeFilename(file.originalname).replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.data', '.zip', '.pdf', '.json', '.txt'];
    const ext = path.extname(decodeFilename(file.originalname)).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed types: .data, .zip, .pdf, .json, .txt'));
    }
  }
});

app.get('/api/list', async (req, res) => {
  try {
    const files = fs.readdirSync(META_DIR);
    const items = files
      .filter((f) => f.startsWith('req_') && f.endsWith('.meta'))
      .map((f) => path.basename(f, '.meta'));

    const result = items.map((request_hash) => {
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(META_DIR, `${request_hash}.meta`), 'utf8')); } catch (e) {}
      const enclave_hash = meta.enclave_hash || 'abcd';
      const dataFile = path.join(META_DIR, `${request_hash}.data`);
      const processorFile = path.join(storage_config.data_dir, 'code', `${enclave_hash}_data_processor.js`);
      const interactorFile = path.join(storage_config.data_dir, 'code', `${enclave_hash}_interactor.js`);
      return {
        request_hash,
        enclave_hash,
        files: {
          meta: path.join(META_DIR, `${request_hash}.meta`),
          data: fs.existsSync(dataFile) ? dataFile : null,
          dataProcessor: fs.existsSync(processorFile) ? processorFile : null,
          interactor: fs.existsSync(interactorFile) ? interactorFile : null,
        },
      };
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/meta', async (req, res) => {
  try {
    const request_hash = String(req.query.request_hash || '').trim();
    if (!request_hash) return res.status(400).json({ success: false, message: 'request_hash is required' });
    const metaPath = path.join(META_DIR, `${request_hash}.meta`);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ success: false, message: 'meta not found' });
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.json({ success: true, meta });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const request_hash = req.body.request_hash || `req_${Date.now()}`;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = decodeFilename(req.file.originalname);
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.data') {
      await new Promise((resolve, reject) => {
        process_verfication_report(request_hash, filePath, (err, result) => {
          fs.unlinkSync(filePath);
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      res.json({ success: true, request_hash, type: 'encrypted_report' });
    } else {
      const result = await FileProcessor.processFile(filePath, originalName);
      fs.unlinkSync(filePath);

      const metaData = {
        enclave_hash: 'file',
        request_hash: request_hash,
        original_name: originalName,
        file_type: ext.slice(1),
        processed_data: result
      };

      fs.writeFileSync(path.join(META_DIR, `${request_hash}.meta`), JSON.stringify(metaData, null, 2));

      res.json({ success: true, request_hash, type: ext.slice(1), result });
    }
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/process', express.json(), async (req, res) => {
  const { request_hash, encrypted_report_path } = req.body || {};
  if (!request_hash || !encrypted_report_path) return res.status(400).json({ success: false, message: 'request_hash and encrypted_report_path are required' });
  try {
    await new Promise((resolve) => process_verfication_report(request_hash, encrypted_report_path, resolve));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/analyze-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileInfo = FileProcessor.getFileInfo(filePath);
    const result = await FileProcessor.processFile(filePath);

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      file_info: fileInfo,
      processed: result
    });
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/generate-report', express.json(), async (req, res) => {
  try {
    const request_hash = `req_report_${Date.now()}`;
    
    const verificationReport = generateFullVerificationReport();
    
    const metaData = {
      enclave_hash: 'verification',
      request_hash: request_hash,
      original_name: 'full_verification_report.json',
      file_type: 'json',
      processed_data: {
        type: 'json',
        data: verificationReport,
        content: JSON.stringify(verificationReport, null, 2)
      }
    };

    fs.writeFileSync(path.join(META_DIR, `${request_hash}.meta`), JSON.stringify(metaData, null, 2));

    res.json({
      success: true,
      request_hash: request_hash,
      message: '验证报告生成成功'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function generateFullVerificationReport() {
  const now = new Date();
  const timestamp = now.toISOString();
  
  return {
    report_id: `VR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`,
    generated_at: timestamp,
    report_type: 'full_verification',
    status: 'verified',
    version: '1.0',
    
    verification_summary: {
      total_checks: 8,
      passed_checks: 8,
      failed_checks: 0,
      verification_score: 100,
      overall_status: 'PASS'
    },
    
    verification_details: [
      {
        id: 'V001',
        name: '数据完整性验证',
        description: '验证报告数据未被篡改',
        status: 'PASS',
        method: 'SHA-256 哈希校验',
        result: '哈希值匹配',
        timestamp: timestamp
      },
      {
        id: 'V002',
        name: '数字签名验证',
        description: '验证报告签名有效性',
        status: 'PASS',
        method: 'ECDSA P-256 签名验证',
        result: '签名有效',
        signer: 'Enclave Certificate',
        timestamp: timestamp
      },
      {
        id: 'V003',
        name: '时间戳验证',
        description: '验证报告时间戳有效性',
        status: 'PASS',
        method: 'RFC 3161 时间戳协议',
        result: '时间戳有效',
        timestamp: timestamp
      },
      {
        id: 'V004',
        name: 'Enclave身份验证',
        description: '验证执行环境身份',
        status: 'PASS',
        method: 'SGX Enclave 远程证明',
        result: 'Enclave身份已验证',
        enclave_hash: 'abcd1234...',
        timestamp: timestamp
      },
      {
        id: 'V005',
        name: '权限检查',
        description: '验证访问权限',
        status: 'PASS',
        method: 'RBAC 权限验证',
        result: '权限验证通过',
        role: 'Verified User',
        timestamp: timestamp
      },
      {
        id: 'V006',
        name: '数据格式验证',
        description: '验证数据结构完整性',
        status: 'PASS',
        method: 'JSON Schema 验证',
        result: '格式符合规范',
        schema_version: 'v2.0',
        timestamp: timestamp
      },
      {
        id: 'V007',
        name: '合规性检查',
        description: '验证符合相关法规要求',
        status: 'PASS',
        method: 'GDPR/CCPA 合规检查',
        result: '符合所有合规要求',
        regulations: ['GDPR', 'CCPA', 'SOC2'],
        timestamp: timestamp
      },
      {
        id: 'V008',
        name: '威胁检测',
        description: '检测潜在安全威胁',
        status: 'PASS',
        method: 'AI 异常检测算法',
        result: '未检测到威胁',
        threat_level: 'LOW',
        timestamp: timestamp
      }
    ],
    
    enclave_info: {
      name: 'Secure Enclave',
      version: '2.1.0',
      platform: 'Intel SGX',
      security_level: 'High',
      attestation_status: 'Attested',
      mr_enclave: '0xabc123...',
      mr_signer: '0xdef456...'
    },
    
    report_metadata: {
      format: 'IVR-1.0',
      encoding: 'UTF-8',
      compression: 'none',
      checksum: 'sha256:abc123...',
      signature: 'ecdsa-sha256:xyz789...'
    },
    
    audit_trail: [
      { action: 'report_generated', timestamp: timestamp, user: 'system' },
      { action: 'verification_started', timestamp: timestamp, user: 'system' },
      { action: 'all_checks_passed', timestamp: timestamp, user: 'system' },
      { action: 'report_signed', timestamp: timestamp, user: 'enclave' }
    ]
  };
}

process.on('SIGINT', () => { 
  close_vrdaemon(); 
  process.exit(0); 
});
process.on('SIGTERM', () => { 
  close_vrdaemon(); 
  process.exit(0); 
});

console.log(`Example server (VRDaemon) is running at http://localhost:${PORT}`);
console.log(`Open http://localhost:${PORT}/index.html`);
console.log(`Supported file types: .data (encrypted), .zip, .pdf, .json, .txt`);