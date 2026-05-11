const fs = require("fs");
const path = require('path');

const processorCodeKey = function(enclave_hash){
    return enclave_hash + "_p";
}

const interactorCodeKey = function(enclave_hash){
    return enclave_hash + "_i";
}

const code_dir = function(_storage_config){
    let dir;
    if(_storage_config === undefined){
      dir = path.join(__dirname, "code");
    } else {
      dir = path.join(_storage_config.data_dir, "code");
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

const loadHandler = async function(all_code_store, code_dir_path, codeKey, fileSuffix, codeProvider, enclaveHash, errorPrefix) {
    const cacheKey = codeKey(enclaveHash);
    let handler = all_code_store.access(cacheKey);
    
    if (handler === null) {
        const modulePath = path.join(code_dir_path, `${enclaveHash}${fileSuffix}`);
        const code = typeof codeProvider === 'function' ? await codeProvider(enclaveHash) : codeProvider;
        fs.writeFileSync(modulePath, code);
        handler = require(modulePath);
        all_code_store.add(cacheKey, handler);
    }
    
    if (typeof handler !== 'function') {
        throw new Error(`Invalid ${errorPrefix} for enclave hash: ${enclaveHash}`);
    }
    
    return handler;
}

const loadInteractiveHandler = async function(all_interactor_code, code_dir_path, meta_provider, enclaveHash) {
    try {
        return await loadHandler(
            all_interactor_code,
            code_dir_path,
            interactorCodeKey,
            '_interactor.js',
            (hash) => meta_provider.getInteractorCode(hash),
            enclaveHash,
            'handler'
        );
    } catch (error) {
        throw new Error(`Error loading enclave handler: ${error.message}`);
    }
}

const loadDataProcessorHandler = async function(all_processor_code, code_dir_path, processor_code, enclaveHash) {
    try {
        return await loadHandler(
            all_processor_code,
            code_dir_path,
            processorCodeKey,
            '_data_processor.js',
            processor_code,
            enclaveHash,
            'data processor code'
        );
    } catch (error) {
        throw new Error(`Error loading data processor code: ${error.message}`);
    }
}

module.exports = { code_dir, loadDataProcessorHandler, loadInteractiveHandler };