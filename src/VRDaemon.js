const WorkerPool = require('./WorkerPool.js');
const os = require('node:os');
const fs = require("fs")
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const {code_dir, loadInteractiveHandler} = require("./Util.js")
const ReportInteractorCode = require('./ReportInteractorCode.js');
var log = require("loglevel").getLogger("interactive-verification-report/VRDaemon");

let pool = undefined;
let app = undefined;
let all_handler = undefined
let api_server = undefined
let meta_file_dir=undefined
let _storage_context = undefined
let _meta_provider = undefined

const get_express_instance = function(){
  return app;
}

const init_vrdaemon =  function(meta_provider, port, storage_context, all_meta_file_dir = "./"){
  pool = new WorkerPool(path.resolve(__dirname, 'TaskProcessor.js'), os.availableParallelism());
  app = express()
  app.use(bodyParser.json()); // 支持 JSON 格式的请求体

  if(all_handler === undefined){
    all_handler = new ReportInteractorCode()
  }

  meta_file_dir = all_meta_file_dir
  _storage_context = storage_context
  _meta_provider = meta_provider
  // 定义一个 API 接口，接受 request_hash 和参数
  app.get('/api/report', (req, res) => {
    const request_hash = req.query.request_hash; // 获取 request_hash
    let params = req.query.params; // 扩展参数，支持 JSON 字符串
    //console.log("reqbody: ", req)
    (async()=>{
      if (!request_hash) {
        return res.status(400).json({ success: false, result: null, error: { code: 'INVALID_REQUEST', message: 'request_hash is required' }, meta: { request_hash: null } });
      }
      const enclave_hash = await meta_provider.getEnclaveHash(request_hash);

      try {
        // 根据 enclave_hash 动态加载并执行处理
        const enclaveHandler = await loadInteractiveHandler(all_handler, code_dir(_storage_context), meta_provider, enclave_hash);

        const meta_file = path.join(meta_file_dir, request_hash + ".meta")
        if (!fs.existsSync(meta_file)){
          return res.status(404).json({ success:false, result:null, error:{ code:'META_NOT_FOUND', message:`Meta not found for ${request_hash}`}, meta:{ request_hash, enclave_hash }});
        }

        const meta = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

        // 解析 params（支持字符串 JSON），并抽取规范字段
        let p = params;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch { p = { raw: p }; }
        }
        if (!p || typeof p !== 'object') p = {};
        const action = typeof p.action === 'string' ? p.action.toLowerCase() : undefined;
        const format = typeof p.format === 'string' ? p.format.toLowerCase() : undefined;
        const version = typeof p.version === 'string' ? p.version : undefined;

        // 条件缓存：基于 meta + enclave_hash + action + format 生成弱 ETag
        try {
          const etagPayload = JSON.stringify({ meta, enclave_hash, action, format });
          const etag = 'W/"' + crypto.createHash('sha1').update(etagPayload).digest('hex') + '"';
          res.setHeader('ETag', etag);
          const inm = req.headers['if-none-match'];
          if (inm && inm === etag) {
            return res.status(304).end();
          }
        } catch(_) { /* ignore etag errors */ }

        // 传递 storage 与 params 给处理函数：形如 (meta, storage, params)
        const result = enclaveHandler(meta, _storage_context, params);
        res.json({success:true, result, error:null, meta:{ request_hash, enclave_hash, action, format, version }});
      } catch (error) {
        res.status(500).json({ success: false, result:null, error: { code: 'INTERNAL_ERROR', message: error.message }, meta: { request_hash } });
      }
    })();
    
  });

  // 启动服务器
  api_server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

const close_vrdaemon = function (){
  if(pool !== undefined){
    pool.close();
  }
  if(api_server !== undefined){
    api_server.close();
  }
  if(all_handler !== undefined){
    all_handler.stop();
  }
}

const process_verfication_report = async function(request_hash, local_encrypted_report_url, callback) {
    try {
        if (!pool) {
            throw new Error('VRDaemon not initialized');
        }

        const enclave_hash = await _meta_provider.getEnclaveHash(request_hash);
        const processor_code = await _meta_provider.getDataProcessorCode(enclave_hash);
        const interactor_code = await _meta_provider.getInteractorCode(enclave_hash);
        const shu_private_key = await _meta_provider.getShuPrivateKey();

        const task = {
            storage: _storage_context,
            report: local_encrypted_report_url,
            meta: {
                processor_code: processor_code,
                interactor_code: interactor_code,
                shu_private_key: shu_private_key,
                enclave_hash: enclave_hash
            },
            meta_file_dir: meta_file_dir,
            request_hash: request_hash
        };

        pool.runTask(task, (err, result) => {
            if (err) {
                log.error('Task execution error:', err.message);
                return callback(err, null);
            }

            if (result && typeof result === 'object') {
                if (result.success === false) {
                    const error = new Error(result.error || 'Unknown error');
                    log.error('Task failed:', result.error);
                    return callback(error, null);
                }
                return callback(null, result.result || result);
            }

            callback(null, result);
        });
    } catch (err) {
        log.error('Failed to prepare task:', err.message);
        callback(err, null);
    }
}

module.exports = {
  get_express_instance,
  init_vrdaemon,
  close_vrdaemon,
  process_verfication_report,
}

