const fs = require('fs');
const path = require('path');
const { Sealer } = require('@yeez-tech/meta-encryptor');
const { Readable } = require('stream');

const testDataDir = path.join(__dirname, '../test_data');
const key_pair = {
    private_key: "60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8",
    public_key: "731234931a081e9beae856318a9bf32ac3698ea8215bf74f517f8377cc6ba8740e28ed87c97d0ee8775bc83505867b0bc34a66adc91f0ea9b44c80533f1a3dca"
};

const testReports = [
    {
        request_hash: 'req_abcdefg',
        content: 'Hello, this is a test verification report. This report contains sample data for demonstration purposes.',
        enclave_hash: 'abcd'
    },
    {
        request_hash: 'req_test_001',
        content: JSON.stringify({
            type: 'verification_report',
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                user_id: 'user_12345',
                action: 'login',
                status: 'success',
                details: {
                    ip: '192.168.1.100',
                    device: 'desktop',
                    browser: 'Chrome'
                }
            }
        }, null, 2),
        enclave_hash: 'abcd'
    },
    {
        request_hash: 'req_test_002',
        content: JSON.stringify({
            type: 'transaction_report',
            version: '2.0',
            timestamp: new Date().toISOString(),
            transaction: {
                id: 'txn_98765',
                amount: 1000.50,
                currency: 'CNY',
                from: 'account_A',
                to: 'account_B',
                status: 'completed'
            }
        }, null, 2),
        enclave_hash: 'abcd'
    },
    {
        request_hash: 'req_demo_report',
        content: `交互式验证报告演示数据

报告类型：安全验证报告
生成时间：${new Date().toLocaleString('zh-CN')}
Enclave标识：abcd
请求标识：req_demo_report

报告内容：
- 验证状态：通过
- 验证时间：2026-05-11 10:30:00
- 验证结果：成功
- 数据完整性：100%
- 签名验证：通过`,
        enclave_hash: 'abcd'
    },
    {
        request_hash: 'req_large_data',
        content: JSON.stringify({
            type: 'audit_log',
            version: '1.0',
            timestamp: new Date().toISOString(),
            records: Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                action: ['create', 'read', 'update', 'delete'][Math.floor(Math.random() * 4)],
                user: `user_${String(i).padStart(4, '0')}`,
                timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
                status: Math.random() > 0.1 ? 'success' : 'failed'
            }))
        }, null, 2),
        enclave_hash: 'abcd'
    }
];

async function generateEncryptedReport(request_hash, content, outputDir) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, `${request_hash}.data`);
        
        const rs = Readable.from(content);
        const ws = fs.createWriteStream(outputPath);
        
        rs.pipe(new Sealer({ keyPair: key_pair })).pipe(ws);
        
        ws.on('finish', () => {
            console.log(`Generated: ${outputPath}`);
            resolve(outputPath);
        });
        
        ws.on('error', reject);
        rs.on('error', reject);
    });
}

async function main() {
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
    }

    console.log('Generating test data files...');
    console.log('============================\n');

    for (const report of testReports) {
        try {
            await generateEncryptedReport(report.request_hash, report.content, testDataDir);
        } catch (error) {
            console.error(`Error generating ${report.request_hash}:`, error.message);
        }
    }

    console.log('\n============================');
    console.log(`Successfully generated ${testReports.length} test files`);
    console.log(`Output directory: ${testDataDir}`);
}

main().catch(console.error);