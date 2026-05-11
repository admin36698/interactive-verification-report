const fs = require('fs');
const path = require('path');

const { init_vrdaemon, process_verfication_report, close_vrdaemon } = require('../src/VRDaemon');

class TestMetaProvider {
    constructor(processorPath, interactorPath) {
        this.processorPath = processorPath;
        this.interactorPath = interactorPath;
    }
    async getDataProcessorCode(enclave_hash) {
        return fs.readFileSync(this.processorPath, 'utf-8');
    }
    async getInteractorCode(enclave_hash) {
        return fs.readFileSync(this.interactorPath, 'utf-8');
    }
    async getShuPrivateKey() {
        return "60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8";
    }
    async getEnclaveHash(request_hash) {
        return 'abcd';
    }
}

const testDataDir = path.join(__dirname, '../test_data');
const processorPath = path.join(__dirname, '../test/simple/VRDataProcessor.js');
const interactorPath = path.join(__dirname, '../test/simple/VRInteractor.js');

const testReports = [
    { request_hash: 'req_abcdefg', file: 'req_abcdefg.data' },
    { request_hash: 'req_test_001', file: 'req_test_001.data' },
    { request_hash: 'req_test_002', file: 'req_test_002.data' },
    { request_hash: 'req_demo_report', file: 'req_demo_report.data' },
    { request_hash: 'req_large_data', file: 'req_large_data.data' }
];

async function main() {
    console.log('Processing test data files...');
    console.log('============================\n');

    const metaProvider = new TestMetaProvider(processorPath, interactorPath);
    const storageConfig = {
        db: { name: 'sqlite3', filename: 'test_sqlite.db' },
        cdn: {},
        data_dir: testDataDir
    };

    init_vrdaemon(metaProvider, 0, storageConfig, testDataDir);

    let successCount = 0;
    let failCount = 0;

    for (const report of testReports) {
        const filePath = path.join(testDataDir, report.file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${report.file} - 文件不存在`);
            failCount++;
            continue;
        }

        try {
            await new Promise((resolve) => {
                process_verfication_report(report.request_hash, filePath, resolve);
            });
            
            const metaPath = path.join(testDataDir, `${report.request_hash}.meta`);
            if (fs.existsSync(metaPath)) {
                console.log(`✅ ${report.file} -> ${report.request_hash}.meta`);
                successCount++;
            } else {
                console.log(`⚠️ ${report.file} - 处理完成但元数据文件未生成`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ ${report.file} - 处理失败: ${error.message}`);
            failCount++;
        }
    }

    close_vrdaemon();

    console.log('\n============================');
    console.log(`处理完成: ${successCount} 成功, ${failCount} 失败`);
    console.log(`元数据文件已保存到: ${testDataDir}`);
}

main().catch(console.error);