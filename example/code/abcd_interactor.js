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

function api_summary(meta, storage, p) {
    const processed_data = meta.processed_data;
    const dataLength = processed_data ? 
        (typeof processed_data === 'string' ? processed_data.length : 
         processed_data.content?.length || processed_data.text?.length || JSON.stringify(processed_data).length) : 0;
    
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

function getFileIcon(fileType) {
    const icons = {
        '.pdf': '📄',
        '.json': '📋',
        '.txt': '📝',
        '.md': '📝',
        '.xml': '📋',
        '.csv': '📊',
        '.data': '📦',
        '.zip': '📁',
        '.rar': '📁',
        '.7z': '📁',
        '.ani': '🖱️',
        '.cur': '🖱️',
        '.inf': '⚙️',
        '.url': '🔗',
        '.unknown': '📄'
    };
    return icons[fileType.toLowerCase()] || '📄';
}

function generatePieChart(stats, size = 200, radius = 80) {
    const colors = ['#60a5fa', '#8b5cf6', '#34d399', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
    const center = size / 2;
    let currentAngle = -90;
    const paths = [];
    
    Object.entries(stats).forEach(([ext, count], index) => {
        const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
        const percentage = (count / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (currentAngle * Math.PI) / 180;
        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);
        const color = colors[index % colors.length];
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        paths.push(`<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.8"/>`);
    });
    
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20"/>
            ${paths.join('')}
        </svg>
    `;
}

function generatePieChartLegend(stats) {
    const colors = ['#60a5fa', '#8b5cf6', '#34d399', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(stats).map(([ext, count], index) => {
        const percentage = ((count / total) * 100).toFixed(1);
        const color = colors[index % colors.length];
        return `
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:12px;height:12px;border-radius:3px;background:${color};"></div>
                <span style="color:#9aa4b2;font-size:13px;">${safe(ext)}</span>
                <span style="color:#e6e8ee;font-size:13px;margin-left:auto;">${count} 个 (${percentage}%)</span>
            </div>
        `;
    }).join('');
}

function renderZipContent(processed_data) {
    if (!processed_data || !processed_data.files) return '';
    
    const files = processed_data.files || [];
    const fileTypeStats = {};
    files.forEach(file => {
        const ext = file.type || '.unknown';
        fileTypeStats[ext] = (fileTypeStats[ext] || 0) + 1;
    });
    
    const pieChart = Object.keys(fileTypeStats).length > 0 ? generatePieChart(fileTypeStats, 180, 70) : '';
    const pieChartLegend = Object.keys(fileTypeStats).length > 0 ? generatePieChartLegend(fileTypeStats) : '';
    
    return `
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <h3 style="margin:0;font-size:15px;color:#e6e8ee;">📦 ZIP 文件内容</h3>
                <span style="font-size:12px;color:#9aa4b2;">共 ${files.length} 个文件</span>
            </div>
            
            ${Object.keys(fileTypeStats).length > 0 ? `
            <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <h3 style="margin:0 0 16px 0;font-size:15px;color:#e6e8ee;">📊 文件类型分布</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                    <div style="display:flex;justify-content:center;align-items:center;">
                        ${pieChart}
                    </div>
                    <div style="display:grid;gap:10px;">
                        ${pieChartLegend}
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div style="padding:16px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;">
                    ${files.map((file, index) => `
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">${getFileIcon(file.type)}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="color:#e6e8ee;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(file.name)}</div>
                                <div style="color:#9aa4b2;font-size:11px;">${(file.size / 1024).toFixed(1)} KB</div>
                            </div>
                            ${file.content && !file.isBinary ? `
                            <button onclick="toggleFileContent_${index}()" style="padding:6px 12px;border:none;border-radius:4px;background:rgba(89,140,255,0.2);color:#5b8cff;font-size:12px;cursor:pointer;">
                                查看
                            </button>
                            ` : ''}
                        </div>
                        <script>
                            function toggleFileContent_${index}() {
                                const el = document.getElementById('file-content-${index}');
                                el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }
                        </script>
                        ${file.content && !file.isBinary ? `
                        <div id="file-content-${index}" style="display:none;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px;margin-top:-4px;">
                            <pre style="margin:0;color:#e2e8f0;font-size:13px;overflow-x:auto;max-height:150px;">${safe(file.content)}</pre>
                        </div>
                        ` : ''}
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function api_html(meta, storage, p) {
    const title = p.title || '交互式验证报告';
    const fileType = meta.file_type;
    const processed_data = meta.processed_data;
    const isZip = fileType === 'zip';
    
    const dataLength = processed_data ? 
        (typeof processed_data === 'string' ? processed_data.length : 
         processed_data.content?.length || processed_data.text?.length || JSON.stringify(processed_data).length) : 0;
    
    let contentHtml = '';
    if (isZip && processed_data) {
        contentHtml = renderZipContent(processed_data);
    } else if (processed_data) {
        if (processed_data.content) {
            contentHtml = `<pre style="margin:0;color:#e2e8f0;font-size:13px;white-space:pre-wrap;word-break:break-word;">${safe(processed_data.content.substring(0, 1000))}${processed_data.content.length > 1000 ? '...' : ''}</pre>`;
        } else if (processed_data.text) {
            contentHtml = `<pre style="margin:0;color:#e2e8f0;font-size:13px;white-space:pre-wrap;word-break:break-word;">${safe(processed_data.text.substring(0, 1000))}${processed_data.text.length > 1000 ? '...' : ''}</pre>`;
        } else {
            try {
                const jsonStr = JSON.stringify(processed_data, null, 2);
                contentHtml = `<pre style="margin:0;color:#e2e8f0;font-size:13px;">${safe(jsonStr.substring(0, 2000))}${jsonStr.length > 2000 ? '...' : ''}</pre>`;
            } catch (e) {
                contentHtml = `<p style="color:#9aa4b2;">无法显示内容</p>`;
            }
        }
    }

    return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
            <h1 style="color:#60a5fa;">${safe(title)}</h1>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;">
                <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:8px;">
                    <h3 style="color:#e6e8ee;margin:0 0 12px;">📊 报告摘要</h3>
                    <div style="font-size:13px;color:#9aa4b2;">
                        <div>数据长度: <span style="color:#5b8cff;">${dataLength.toLocaleString()} 字符</span></div>
                        <div>文件类型: ${safe(fileType || 'data')}</div>
                        <div>生成时间: ${new Date().toLocaleString('zh-CN')}</div>
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:8px;">
                    <h3 style="color:#e6e8ee;margin:0 0 12px;">🔑 安全信息</h3>
                    <div style="font-size:13px;color:#9aa4b2;">
                        <div>Enclave标识: <span style="color:#34d399;">${safe(meta.enclave_hash || '-').substring(0, 12)}...</span></div>
                        <div>请求标识: <span style="color:#34d399;">${safe(meta.request_hash || '-').substring(0, 12)}...</span></div>
                    </div>
                </div>
            </div>
            ${contentHtml ? `
            <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:8px;">
                <h3 style="color:#e6e8ee;margin:0 0 12px;">📋 数据内容</h3>
                ${contentHtml}
            </div>
            ` : ''}
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
