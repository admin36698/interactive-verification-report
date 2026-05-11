const path = require('path');
const fs = require('fs');
const FileProcessor = require('../src/FileProcessor');

const testDataDir = path.join(__dirname, '../test_data');

async function testFileTypes() {
    console.log('=== 文件类型处理测试 ===\n');

    const testFiles = [
        { name: 'test_report.txt', type: '文本文件' },
        { name: 'test_data.json', type: 'JSON文件' },
        { name: '../main.pdf', type: 'PDF文件' },
    ];

    for (const { name, type } of testFiles) {
        const filePath = path.join(testDataDir, name);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${type} [${name}] - 文件不存在`);
            continue;
        }

        try {
            console.log(`📄 测试 ${type} [${name}]`);
            
            const fileInfo = FileProcessor.getFileInfo(filePath);
            console.log(`   文件信息: ${fileInfo.size} bytes, ${fileInfo.type}`);

            const result = await FileProcessor.processFile(filePath);
            console.log(`   处理类型: ${result.type}`);

            if (result.type === 'txt') {
                console.log(`   内容长度: ${result.content.length} 字符`);
                console.log(`   预览: ${result.content.substring(0, 50)}...`);
            } else if (result.type === 'json') {
                console.log(`   JSON解析: ${result.error ? '失败' : '成功'}`);
                if (result.data) {
                    console.log(`   键数量: ${Object.keys(result.data).length}`);
                }
            } else if (result.type === 'pdf') {
                console.log(`   页数: ${result.numPages || '未知'}`);
                console.log(`   文本长度: ${result.text ? result.text.length : 0} 字符`);
                if (result.info) {
                    console.log(`   元信息: ${Object.keys(result.info).join(', ')}`);
                }
            }

            if (result.error) {
                console.log(`   ⚠️  警告: ${result.error}`);
            }

            console.log('   ✅ 处理成功\n');
        } catch (error) {
            console.log(`   ❌ 处理失败: ${error.message}\n`);
        }
    }

    console.log('=== 测试完成 ===');
}

testFileTypes().catch(console.error);