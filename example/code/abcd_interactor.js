function parseParams(params) {
    if (typeof params === 'string') {
        try { return JSON.parse(params); } catch { return { raw: params }; }
    }
    return params || {};
}

function safe(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function api_json(meta, storage, p) {
    return { 
        meta, 
        note: 'served by abcd_interactor (json format)', 
        params: p,
        timestamp: new Date().toISOString()
    };
}

function calculateDataLength(processed_data, file_type) {
    if (!processed_data) return 0;
    
    switch (file_type) {
        case 'txt':
            return processed_data.length || processed_data.content?.length || 0;
        case 'json':
            return processed_data.content?.length || (processed_data.data ? JSON.stringify(processed_data.data).length : 0);
        case 'pdf':
            return processed_data.text?.length || 0;
        case 'zip':
            return processed_data.files?.reduce((sum, f) => sum + (f.content?.length || 0), 0) || 0;
        default:
            if (typeof processed_data === 'string') return processed_data.length;
            if (typeof processed_data === 'object') {
                if (processed_data.content) return processed_data.content.length;
                if (processed_data.data) return JSON.stringify(processed_data.data).length;
                if (processed_data.text) return processed_data.text.length;
                return JSON.stringify(processed_data).length;
            }
            return 0;
    }
}

function api_summary(meta, storage, p) {
    const processed_data = meta.processed_data;
    const dataLength = calculateDataLength(processed_data, meta.file_type);
    
    const result = {
        summary: '验证报告摘要',
        request_hash: meta.request_hash,
        enclave_hash: meta.enclave_hash,
        file_type: meta.file_type || 'data',
        original_name: meta.original_name || undefined,
        data_preview: processed_data?.content?.substring(0, 100) + (processed_data?.content?.length > 100 ? '...' : '') || 
                     processed_data?.text?.substring(0, 100) + (processed_data?.text?.length > 100 ? '...' : '') || 'N/A',
        generated_at: new Date().toISOString()
    };
    
    if (dataLength > 0) {
        result.data_length = dataLength;
    }
    
    return result;
}

function renderZipContent(processed_data) {
    if (!processed_data || !processed_data.files) return '';
    
    const files = processed_data.files || [];
    return `
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📦 ZIP 文件内容</h3>
                <span style="font-size:12px;color:#9aa4b2;">共 ${files.length} 个文件</span>
            </div>
            <div style="padding:12px;">
                <div style="display:grid;gap:8px;">
                    ${files.map((file, index) => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:6px;">
                            <span style="font-size:18px;">${file.type === '.pdf' ? '📄' : file.type === '.json' ? '📋' : file.type === '.txt' ? '📝' : '📁'}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="color:#e6e8ee;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(file.name)}</div>
                                <div style="color:#9aa4b2;font-size:12px;">${(file.size / 1024).toFixed(2)} KB</div>
                            </div>
                            <button onclick="toggleFileContent(${index})" style="padding:6px 12px;border:none;border-radius:4px;background:rgba(89,140,255,0.2);color:#5b8cff;font-size:12px;cursor:pointer;">
                                查看内容
                            </button>
                        </div>
                        <div id="file-content-${index}" style="display:none;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px;margin-top:-4px;">
                            <pre style="margin:0;color:#e2e8f0;font-size:13px;overflow-x:auto;max-height:200px;">${safe(file.content || file.isBinary ? '[二进制文件，无法显示]' : '')}</pre>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <script>
            function toggleFileContent(index) {
                const el = document.getElementById('file-content-' + index);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        </script>
    `;
}

function renderPdfContent(processed_data) {
    if (!processed_data) return '';
    
    return `
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📄 PDF 文档内容</h3>
                <span style="font-size:12px;color:#9aa4b2;">共 ${processed_data.numPages || 1} 页</span>
            </div>
            ${processed_data.info && Object.keys(processed_data.info).length > 0 ? `
            <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);">
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;font-size:13px;">
                    ${Object.entries(processed_data.info).map(([key, value]) => `
                        <div>
                            <span style="color:#9aa4b2;">${safe(key)}:</span>
                            <span style="color:#e6e8ee;margin-left:8px;">${safe(String(value))}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            <div style="padding:16px;">
                <div style="max-height:500px;overflow-y:auto;">
                    <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;white-space:pre-wrap;">${safe(processed_data.text || '')}</p>
                </div>
            </div>
        </div>
    `;
}

function renderJsonContent(processed_data) {
    if (!processed_data || !processed_data.data) return '';
    
    return `
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📋 JSON 数据</h3>
            </div>
            <pre style="margin:0;padding:16px;background:transparent;color:#e2e8f0;font-size:13px;overflow-x:auto;max-height:500px;">${safe(JSON.stringify(processed_data.data, null, 2))}</pre>
        </div>
    `;
}

function generateReportSummary(meta) {
    const processed_data = meta.processed_data;
    const fileType = meta.file_type;
    const dataLength = calculateDataLength(processed_data, fileType);
    
    const reportSummary = {
        request_hash: meta.request_hash,
        enclave_hash: meta.enclave_hash,
        file_type: fileType || 'data',
        original_name: meta.original_name,
        data_length: dataLength,
        generated_at: new Date().toISOString(),
        data_preview: processed_data?.content?.substring(0, 100) + (processed_data?.content?.length > 100 ? '...' : '') ||
                     processed_data?.text?.substring(0, 100) + (processed_data?.text?.length > 100 ? '...' : '') || 'N/A'
    };
    
    return reportSummary;
}

function renderVerificationReport(meta) {
    const processed_data = meta.processed_data;
    const fileType = meta.file_type;
    const isZip = fileType === 'zip';
    
    const files = (isZip && processed_data?.files) || [];
    const totalFiles = files.length || 0;
    
    const fileTypeStats = {};
    let totalSize = 0;
    files.forEach(file => {
        const ext = file.type || '.unknown';
        fileTypeStats[ext] = (fileTypeStats[ext] || 0) + 1;
        totalSize += file.size || 0;
    });
    
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    return `
        <div style="max-width:900px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
            <div style="text-align:center;padding:30px 20px;border-bottom:2px solid #60a5fa;">
                <h1 style="margin:0;font-size:28px;color:#60a5fa;font-weight:600;">压缩数据验证程序</h1>
                <h2 style="margin:8px 0 0 0;font-size:18px;color:#9aa4b2;font-weight:400;">典枢数据质量验证报告</h2>
                <div style="margin-top:16px;display:inline-block;padding:10px 20px;border:2px solid #60a5fa;border-radius:50px;background:rgba(96,165,250,0.1);">
                    <span style="font-size:14px;color:#60a5fa;font-weight:600;">✅ 验证通过</span>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:30px 20px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">
                    <h3 style="margin:0 0 16px 0;font-size:16px;color:#e6e8ee;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;">📊 报告摘要</h3>
                    <div style="display:grid;gap:12px;font-size:14px;">
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">数据标识</span>
                            <span style="font-family:monospace;color:#34d399;">${safe(meta.request_hash || '-')}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">数据名称</span>
                            <span>${safe(meta.original_name || '-')}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">文件大小</span>
                            <span style="color:#f59e0b;">${sizeInMB} MB</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">文件后缀</span>
                            <span>${safe(fileType || 'data')}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">总文件数</span>
                            <span style="color:#22c55e;font-weight:600;">${totalFiles}</span>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">
                    <h3 style="margin:0 0 16px 0;font-size:16px;color:#e6e8ee;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;">🔑 安全信息</h3>
                    <div style="display:grid;gap:12px;font-size:14px;">
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">Enclave标识</span>
                            <span style="font-family:monospace;color:#34d399;">${safe(meta.enclave_hash || '-').substring(0, 12)}...</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">请求标识</span>
                            <span style="font-family:monospace;color:#34d399;">${safe(meta.request_hash || '-').substring(0, 12)}...</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">验证状态</span>
                            <span style="color:#22c55e;">✅ 已验证</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">生成时间</span>
                            <span>${new Date().toLocaleString('zh-CN')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="padding:0 20px 30px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                    <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#e6e8ee;">📋 验证程序信息</h3>
                        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                            <span style="color:#9aa4b2;">验证程序</span>
                            <span style="color:#60a5fa;">压缩数据验证程序</span>
                        </div>
                        <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
                            该程序将对压缩数据进行最小单元的统计分析。程序会汇总压缩数据中存在的各种文件类型，
                            并统计它们的数量和文件大小所占的比例。最终，程序会将结果以饼图统计图表的形式呈现，
                            展示最小单元文件类型及其数量和文件大小所占比例。
                        </p>
                    </div>

                    <div style="padding:20px;">
                        <h3 style="margin:0 0 16px 0;font-size:16px;color:#e6e8ee;">📁 文件内容</h3>
                        ${totalFiles > 0 ? `
                        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;">
                            ${files.map((file, index) => `
                                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;">
                                    <span style="font-size:20px;">${file.type === '.pdf' ? '📄' : file.type === '.json' ? '📋' : file.type === '.txt' ? '📝' : '📁'}</span>
                                    <div style="flex:1;min-width:0;">
                                        <div style="color:#e6e8ee;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(file.name)}</div>
                                        <div style="color:#9aa4b2;font-size:11px;">${(file.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div style="text-align:center;padding:40px;color:#9aa4b2;">
                            <span style="font-size:32px;display:block;margin-bottom:8px;">📂</span>
                            <span>暂无文件内容</span>
                        </div>
                        `}
                    </div>

                    ${isZip && totalFiles > 0 ? `
                    <div style="padding:20px;border-top:1px solid rgba(255,255,255,0.08);">
                        <h3 style="margin:0 0 16px 0;font-size:16px;color:#e6e8ee;">📊 文件类型统计</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;">
                            ${Object.entries(fileTypeStats).map(([type, count]) => {
                                const percentage = ((count / totalFiles) * 100).toFixed(1);
                                return `
                                    <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:12px;">
                                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                                            <span style="color:#9aa4b2;font-size:13px;">${type}</span>
                                            <span style="color:#e6e8ee;font-size:13px;">${count} 个</span>
                                        </div>
                                        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                                            <div style="height:100%;width:${percentage}%;background:linear-gradient(90deg,#60a5fa,#8b5cf6);border-radius:3px;"></div>
                                        </div>
                                        <div style="text-align:right;margin-top:4px;color:#9aa4b2;font-size:11px;">${percentage}%</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function api_html(meta, storage, p) {
    const title = p.title || '交互式验证报告';
    const jsonPretty = safe(JSON.stringify(meta, null, 2));
    
    const isFileUpload = meta.enclave_hash === 'file';
    const fileType = meta.file_type;
    const processed_data = meta.processed_data;
    
    const dataLength = calculateDataLength(processed_data, fileType);
    const hasData = dataLength > 0;
    const isZip = fileType === 'zip';
    
    if (isFileUpload && isZip) {
        return renderVerificationReport(meta);
    }
    
    const dataPreview = processed_data?.content?.substring(0, 200) + (processed_data?.content?.length > 200 ? '...' : '') || 
                       processed_data?.text?.substring(0, 200) + (processed_data?.text?.length > 200 ? '...' : '') || '';
    
    let fileContentHtml = '';
    if (isFileUpload && processed_data) {
        switch (fileType) {
            case 'zip':
                fileContentHtml = renderZipContent(processed_data);
                break;
            case 'pdf':
                fileContentHtml = renderPdfContent(processed_data);
                break;
            case 'json':
                fileContentHtml = renderJsonContent(processed_data);
                break;
            case 'txt':
                fileContentHtml = `
                    <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                        <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📝 文本内容</h3>
                        </div>
                        <div style="padding:16px;">
                            <pre style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${safe(processed_data.content || '')}</pre>
                        </div>
                    </div>
                `;
                break;
        }
    }
    
    const rawData = meta.processed_data || meta.data || meta;
    const files = isZip && rawData?.files ? rawData.files : [];
    
    const fileTypeStats = {};
    let totalSize = 0;
    files.forEach(file => {
        const ext = file.type || '.unknown';
        fileTypeStats[ext] = (fileTypeStats[ext] || 0) + 1;
        totalSize += file.size || 0;
    });
    
    const getRandomSample = (data, percentage = 10, maxLength = 1000) => {
        if (!data) return null;
        const content = typeof data === 'string' ? data : 
                    data.content || data.text || JSON.stringify(data, null, 2);
        const sampleSize = Math.max(1, Math.min(
           Math.floor(content.length * percentage / 100),
           maxLength
        ));
        if (content.length <= sampleSize) return content.substring(0, maxLength);
        const start = Math.floor(Math.random() * (content.length - sampleSize));
        return content.substring(start, start + sampleSize).substring(0, maxLength);
    };
    
    const randomSample = getRandomSample(rawData, 10);
    
    const chartColors = ['#60a5fa', '#8b5cf6', '#34d399', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
    
    let pieChartPaths = '';
    let pieChartLegend = '';
    if (isZip && files.length > 0) {
        let currentAngle = -90;
        const stats = Object.entries(fileTypeStats);
        pieChartPaths = stats.map(([ext, count], index) => {
            const percentage = (count / files.length) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (currentAngle * Math.PI) / 180;
            const x1 = 100 + 80 * Math.cos(startRad);
            const y1 = 100 + 80 * Math.sin(startRad);
            const x2 = 100 + 80 * Math.cos(endRad);
            const y2 = 100 + 80 * Math.sin(endRad);
            const color = chartColors[index % chartColors.length];
            const largeArcFlag = angle > 180 ? 1 : 0;
            return '<path d="M 100 100 L ' + x1 + ' ' + y1 + ' A 80 80 0 ' + largeArcFlag + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + color + '" opacity="0.8"/>';
        }).join('');
        
        pieChartLegend = stats.map(([ext, count], index) => {
            const percentage = ((count / files.length) * 100).toFixed(1);
            const color = chartColors[index % chartColors.length];
            return '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:12px;height:12px;border-radius:3px;background:' + color + ';"></div>' +
                '<span style="color:#9aa4b2;font-size:13px;">' + safe(ext) + '</span>' +
                '<span style="color:#e6e8ee;font-size:13px;margin-left:auto;">' + count + ' 个 (' + percentage + '%)</span>' +
                '</div>';
        }).join('');
    }
    
    return `
        <div style="display:grid;gap:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h1 style="margin:0 0 8px 0;font-size:22px;color:#e6e8ee;">${safe(title)}</h1>
                    <div style="color:#9aa4b2;font-size:14px;">
                        <span style="margin-right:16px;">enclave_hash: ${safe(meta.enclave_hash || 'unknown')}</span>
                        <span>request_hash: ${safe(meta.request_hash || 'unknown')}</span>
                        ${meta.original_name ? `<span style="margin-left:16px;">文件: ${safe(meta.original_name)}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="showRawData()" 
                        style="padding:8px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#e6e8ee;cursor:pointer;font-size:13px;">
                        📋 查看数据抽样 (10%)
                    </button>
                    <button onclick="showSummary()" 
                        style="padding:8px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#e6e8ee;cursor:pointer;font-size:13px;">
                        📊 获取摘要
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">
                    <h3 style="margin:0 0 12px 0;font-size:15px;color:#e6e8ee;">📊 报告摘要</h3>
                    <div style="display:grid;gap:8px;font-size:13px;">
                        ${dataLength > 0 ? `
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">数据长度</span>
                            <span style="color:#5b8cff;">${dataLength.toLocaleString()} 字符</span>
                        </div>
                        ` : ''}
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">文件类型</span>
                            <span>${safe(fileType || 'data')}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">生成时间</span>
                            <span>${new Date().toLocaleString('zh-CN')}</span>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">
                    <h3 style="margin:0 0 12px 0;font-size:15px;color:#e6e8ee;">🔑 安全信息</h3>
                    <div style="display:grid;gap:8px;font-size:13px;">
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">Enclave标识</span>
                            <span style="font-family:monospace;color:#34d399;">${safe(meta.enclave_hash || '-').substring(0, 16)}...</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#9aa4b2;">请求标识</span>
                            <span style="font-family:monospace;color:#34d399;">${safe(meta.request_hash || '-').substring(0, 16)}...</span>
                        </div>
                    </div>
                </div>
            </div>

            <div id="rawDataSection" style="display:none;">
                ${isZip && files.length > 0 ? `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📊 文件类型分布图表</h3>
                    </div>
                    <div style="padding:20px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                            <div style="display:flex;justify-content:center;align-items:center;">
                                <svg width="200" height="200" viewBox="0 0 200 200">
                                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20"/>
                                    ${pieChartPaths}
                                </svg>
                            </div>
                            <div style="display:grid;gap:10px;">
                                ${pieChartLegend}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${randomSample ? `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📋 数据随机抽样 (10%)</h3>
                    </div>
                    <div style="padding:16px;">
                        <pre style="margin:0;color:#e2e8f0;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${safe(randomSample)}</pre>
                    </div>
                </div>
                ` : ''}

                ${!isZip && isFileUpload && fileType && ['pdf', 'json', 'txt'].includes(fileType) ? `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📊 文件组成信息</h3>
                    </div>
                    <div style="padding:20px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                            <div style="display:flex;justify-content:center;">
                                <svg width="150" height="150" viewBox="0 0 150 150">
                                    <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="15"/>
                                    <circle cx="75" cy="75" r="52" fill="#60a5fa" opacity="0.8"/>
                                </svg>
                            </div>
                            <div style="display:flex;flex-direction:column;justify-content:center;gap:10px;">
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div style="width:12px;height:12px;border-radius:3px;background:#60a5fa;"></div>
                                    <span style="color:#9aa4b2;font-size:13px;">.${fileType}</span>
                                    <span style="color:#e6e8ee;font-size:13px;margin-left:auto;">1 个 (100%)</span>
                                </div>
                                <div style="padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
                                    <div style="color:#9aa4b2;font-size:12px;">文件类型</div>
                                    <div style="color:#e6e8ee;font-size:14px;font-weight:500;">${fileType.toUpperCase()} 文件</div>
                                </div>
                                <div>
                                    <div style="color:#9aa4b2;font-size:12px;">数据大小</div>
                                    <div style="color:#f59e0b;font-size:14px;font-weight:500;">${dataLength > 0 ? (dataLength / 1024).toFixed(2) + ' KB' : 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${fileContentHtml ? `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📁 文件内容</h3>
                    </div>
                    <div style="padding:16px;">${fileContentHtml}</div>
                </div>
                ` : ''}
            </div>

            <div id="summarySection" style="display:none;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📊 报告摘要详情</h3>
                    </div>
                    <div style="padding:16px;">
                        <pre id="summaryContent" style="margin:0;color:#e2e8f0;font-size:13px;line-height:1.6;white-space:pre-wrap;">加载中...</pre>
                    </div>
                </div>
            </div>

            <div style="padding:12px;background:rgba(59, 130, 246, 0.1);border:1px solid rgba(59, 130, 246, 0.2);border-radius:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">💡</span>
                    <span style="color:#93c5fd;font-size:13px;">
                        提示：该报告由 <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">VRDataProcessor</code> 处理，并由 <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">VRInteractor</code> 响应展示。
                    </span>
                </div>
            </div>

            <script>
                function showRawData() {
                    const section = document.getElementById('rawDataSection');
                    if (section) {
                        section.style.display = section.style.display === 'none' ? 'grid' : 'none';
                    }
                }
                
                function showSummary() {
                    const section = document.getElementById('summarySection');
                    const content = document.getElementById('summaryContent');
                    
                    if (section.style.display === 'none') {
                        section.style.display = 'grid';
                        content.textContent = '加载中...';
                        
                        const hash = document.getElementById('hashInput') ? document.getElementById('hashInput').value : 'req_abcdefg';
                        const params = encodeURIComponent(JSON.stringify({format: 'summary'}));
                        fetch('/api/report?request_hash=' + encodeURIComponent(hash) + '&params=' + params)
                            .then(r => r.json())
                            .then(data => {
                                if (data.success) {
                                    content.textContent = JSON.stringify(data.result, null, 2);
                                } else {
                                    content.textContent = '获取失败: ' + (data.error?.message || '未知错误');
                                }
                            })
                            .catch(e => {
                                content.textContent = '获取失败: ' + e.message;
                            });
                    } else {
                        section.style.display = 'none';
                    }
                }
                
                function ivrFetchData(format) {
                    const hash = window.location.pathname.includes('index.html') ? 'req_abcdefg' : (document.getElementById('hashInput') || {value: 'req_abcdefg'}).value;
                    const params = encodeURIComponent(JSON.stringify({format: format}));
                    fetch('/api/report?request_hash=' + encodeURIComponent(hash) + '&params=' + params)
                        .then(r => r.json())
                        .then(data => {
                            const pre = document.createElement('pre');
                            pre.style.cssText = 'background:#0b1022;color:#e2e8f0;padding:16px;border-radius:8px;overflow:auto;max-height:400px;font-size:13px;';
                            pre.textContent = JSON.stringify(data.result, null, 2);
                            document.body.appendChild(pre);
                            pre.scrollIntoView({behavior: 'smooth'});
                        })
                        .catch(e => alert('获取失败: ' + e.message));
                }
            </script>
        </div>
    `;
}

function route(meta, storage, p) {
    const action = (p.action || '').toLowerCase();
    const format = (p.format || '').toLowerCase();
    
    if (action === 'summary' || format === 'summary') return api_summary(meta, storage, p);
    if (action === 'json' || format === 'json') return api_json(meta, storage, p);
    
    return api_html(meta, storage, p);
}

module.exports = function(meta, storage, params) {
    const p = parseParams(params);
    return route(meta, storage, p);
};