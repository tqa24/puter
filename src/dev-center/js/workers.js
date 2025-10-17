let sortBy = 'created_at';
let sortDirection = 'desc';
window.workers = [];
let search_query;

window.create_worker = async (name, filePath = null) => {
    let worker;
    
    // show spinner
    puter.ui.showSpinner();

    // Use provided file path or default to the default worker file
    const workerFile = filePath;
    
    try {
        worker = await puter.workers.create(name, workerFile);
    } catch (err) {
        puter.ui.alert(`Error creating worker: ${err.error?.message}`);
    }

    return worker;
}

window.refresh_worker_list = async (show_loading = false) => {
    if (show_loading)
        puter.ui.showSpinner();

    // puter.workers.list() returns an array of worker objects
    try {
        window.workers = await puter.workers.list();
    } catch (err) {
        console.error('Error refreshing worker list:', err);
    }

    // Get workers
    if (window.activeTab === 'workers' && window.workers.length > 0) {
        $('.worker-card').remove();
        $('#no-workers-notice').hide();
        $('#worker-list').show();
        window.workers.forEach((worker) => {
            // append row to worker-list-table
            $('#worker-list-table > tbody').append(generate_worker_card(worker));
        });
    } else {
        $('#no-workers-notice').show();
        $('#worker-list').hide();
    }

    count_workers();

    puter.ui.hideSpinner();
}


async function init_workers() {
    window.workers = await puter.workers.list();
    count_workers();
}

$(document).on('click', '.create-a-worker-btn', async function (e) {
    // if user doesn't have an email, request it
    if(!window.user?.email || !window.user?.email_confirmed){
        const email_confirm_resp = await puter.ui.requestEmailConfirmation();
        if(!email_confirm_resp)
            UIAlert('Email confirmation required to create a worker.');
            return;
    }

    // refresh user data
    window.user = await puter.auth.getUser();

    // Step 1: Show file picker limited to .js files
    let selectedFile;
    try {
        selectedFile = await puter.ui.showOpenFilePicker({
            accept: ".js",
        });
    } catch (err) {
        // User cancelled file picker or there was an error
        console.log('File picker cancelled or error:', err);
        return;
    }

    // Step 2: Ask for worker name
    if (selectedFile && selectedFile.path) {
        let name = await puter.ui.prompt('Please enter a name for your worker:', 'my-awesome-worker');

        // Step 3: Create worker with selected file
        if (name) {
            await create_worker(name, selectedFile.path);
            // Refresh the worker list to show the new worker
            await refresh_worker_list();

            // hide spinner
            puter.ui.hideSpinner();
        }
    }
})

$(document).on('click', '.worker-checkbox', function (e) {
    // was shift key pressed?
    if (e.originalEvent && e.originalEvent.shiftKey) {
        // select all checkboxes in range
        const currentIndex = $('.worker-checkbox').index(this);
        const startIndex = Math.min(window.last_clicked_worker_checkbox_index, currentIndex);
        const endIndex = Math.max(window.last_clicked_worker_checkbox_index, currentIndex);

        // set all checkboxes in range to the same state as current checkbox
        for (let i = startIndex; i <= endIndex; i++) {
            const checkbox = $('.worker-checkbox').eq(i);
            checkbox.prop('checked', $(this).is(':checked'));

            // activate row
            if ($(checkbox).is(':checked'))
                $(checkbox).closest('tr').addClass('active');
            else
                $(checkbox).closest('tr').removeClass('active');
        }
    }

    // determine if select-all checkbox should be checked, indeterminate, or unchecked
    if ($('.worker-checkbox:checked').length === $('.worker-checkbox').length) {
        $('.select-all-workers').prop('indeterminate', false);
        $('.select-all-workers').prop('checked', true);
    } else if ($('.worker-checkbox:checked').length > 0) {
        $('.select-all-workers').prop('indeterminate', true);
        $('.select-all-workers').prop('checked', false);
    }
    else {
        $('.select-all-workers').prop('indeterminate', false);
        $('.select-all-workers').prop('checked', false);
    }

    // activate row
    if ($(this).is(':checked'))
        $(this).closest('tr').addClass('active');
    else
        $(this).closest('tr').removeClass('active');

    // enable delete button if at least one checkbox is checked
    if ($('.worker-checkbox:checked').length > 0)
        $('.delete-workers-btn').removeClass('disabled');
    else
        $('.delete-workers-btn').addClass('disabled');

    // store the index of the last clicked checkbox
    window.last_clicked_worker_checkbox_index = $('.worker-checkbox').index(this);
})

$(document).on('change', '.select-all-workers', function (e) {
    if ($(this).is(':checked')) {
        $('.worker-checkbox').prop('checked', true);
        $('.worker-card').addClass('active');
        $('.delete-workers-btn').removeClass('disabled');
    } else {
        $('.worker-checkbox').prop('checked', false);
        $('.worker-card').removeClass('active');
        $('.delete-workers-btn').addClass('disabled');
    }
})

$('.refresh-worker-list').on('click', function (e) {
    puter.ui.showSpinner();
    refresh_worker_list();

    puter.ui.hideSpinner();
})

$('th.sort').on('click', function (e) {
    // determine what column to sort by
    const sortByColumn = $(this).attr('data-column');

    // toggle sort direction
    if (sortByColumn === sortBy) {
        if (sortDirection === 'asc')
            sortDirection = 'desc';
        else
            sortDirection = 'asc';
    }
    else {
        sortBy = sortByColumn;
        sortDirection = 'desc';
    }

    // update arrow
    $('.sort-arrow').css('display', 'none');
    $('#worker-list-table').find('th').removeClass('sorted');
    $(this).find('.sort-arrow-' + sortDirection).css('display', 'inline');
    $(this).addClass('sorted');

    sort_workers();
});

function sort_workers() {
    let sorted_workers;

    // sort
    if (sortDirection === 'asc'){
        sorted_workers = workers.sort((a, b) => {
            if(sortBy === 'name'){
                return a[sortBy].localeCompare(b[sortBy]);
            }else if(sortBy === 'created_at'){
                return new Date(a[sortBy]) - new Date(b[sortBy]);
            }else if(sortBy === 'file_path'){
                return a[sortBy].localeCompare(b[sortBy]);
            }
            else{
                a[sortBy] > b[sortBy] ? 1 : -1
            }
        });
    }else{
        sorted_workers = workers.sort((a, b) => {
            if(sortBy === 'name'){
                return b[sortBy].localeCompare(a[sortBy]);
            }else if(sortBy === 'created_at'){
                return new Date(b[sortBy]) - new Date(a[sortBy]);
            }else if(sortBy === 'file_path'){
                return b[sortBy].localeCompare(a[sortBy]);
            } else{
                b[sortBy] > a[sortBy] ? 1 : -1
            }
        });
    }
    // refresh worker list
    $('.worker-card').remove();
    sorted_workers.forEach(worker => {
        $('#worker-list-table > tbody').append(generate_worker_card(worker));
    });

    count_workers();

    // show workers that match search_query and hide workers that don't
    if (search_query) {
        // show workers that match search_query and hide workers that don't
        workers.forEach((worker) => {
            if (worker.name.toLowerCase().includes(search_query.toLowerCase())) {
                $(`.worker-card[data-name="${html_encode(worker.name)}"]`).show();
            } else {
                $(`.worker-card[data-name="${html_encode(worker.name)}"]`).hide();
            }
        })
    }
}

function count_workers() {
    let count = window.workers.length;
    $('.worker-count').html(count ? count : '');
    return count;
}

function generate_worker_card(worker) {
    return `
        <tr class="worker-card" data-name="${html_encode(worker.name)}">
            <td style="width:50px; vertical-align: middle; line-height: 1;">
                <input type="checkbox" class="worker-checkbox" data-worker-name="${worker.name}">
            </td>
            <td style="font-family: monospace; font-size: 14px; vertical-align: middle;">${worker.name}</td>
            <td style="font-family: monospace; font-size: 14px; vertical-align: middle;"><span class="worker-file-path" data-worker-file-path="${html_encode(worker.file_path)}">${worker.file_path ? worker.file_path : ''}</span></td>
            <td style="font-size: 14px; vertical-align: middle;">${worker.created_at}</td>
            <td style="vertical-align: middle;"><img class="options-icon options-icon-worker" data-worker-name="${worker.name}" src="./img/options.svg"></td>
        </tr>
    `;
}

$(document).on('input change keyup keypress keydown paste cut', '.search-workers', function (e) {
    search_workers();
})

window.search_workers = function() {
    // search workers for query
    search_query = $('.search-workers').val().toLowerCase();
    if (search_query === '') {
        // hide 'clear search' button
        $('.search-clear-workers').hide();
        // show all workers again
        $(`.worker-card`).show();
        // remove 'has-value' class from search input
        $('.search-workers').removeClass('has-value');
    } else {
        // show 'clear search' button
        $('.search-clear-workers').show();
        // show workers that match search_query and hide workers that don't
        workers.forEach((worker) => {
            if (
                worker.name.toLowerCase().includes(search_query.toLowerCase())
            )
            {
                $(`.worker-card[data-name="${worker.name}"]`).show();
            } else {
                $(`.worker-card[data-name="${worker.name}"]`).hide();
            }
        })
        // add 'has-value' class to search input
        $('.search-workers').addClass('has-value');
    }    
}

$(document).on('click', '.search-clear-workers', function (e) {
    $('.search-workers').val('');
    $('.search-workers').trigger('change');
    $('.search-workers').focus();
    search_query = '';
    // remove 'has-value' class from search input
    $('.search-workers').removeClass('has-value');
})

function remove_worker_card(worker_name, callback = null) {
    $(`.worker-card[data-name="${worker_name}"]`).fadeOut(200, function() {
        $(this).remove();

        // Update the global workers array to remove the deleted worker
        window.workers = window.workers.filter(worker => worker.name !== worker_name);

        if ($(`.worker-card`).length === 0) {
            $('section:not(.sidebar)').hide();
            $('#no-workers-notice').show();
        } else {
            $('section:not(.sidebar)').hide();
            $('#worker-list').show();
        }

        // update select-all-workers checkbox's state
        if($('.worker-checkbox:checked').length === 0){
            $('.select-all-workers').prop('indeterminate', false);
            $('.select-all-workers').prop('checked', false);
        }
        else if($('.worker-checkbox:checked').length === $('.worker-card').length){
            $('.select-all-workers').prop('indeterminate', false);
            $('.select-all-workers').prop('checked', true);
        }
        else{
            $('.select-all-workers').prop('indeterminate', true);
        }

        count_workers();
        if (callback) callback();
    });
}

$(document).on('click', '.delete-workers-btn', async function (e) {
    // show confirmation alert
    let resp = await puter.ui.alert(`Are you sure you want to delete the selected workers?`, [
        {
            label: 'Delete',
            type: 'danger',
            value: 'delete',
        },
        {
            label: 'Cancel',
        },
    ], {
        type: 'warning',
    });

    if (resp === 'delete') {
        // disable delete button
        $('.delete-workers-btn').addClass('disabled');

        // show 'deleting' modal
        puter.ui.showSpinner();

        let start_ts = Date.now();
        const workers = $('.worker-checkbox:checked').toArray();

        // delete all checked workers
        for (let worker of workers) {
            let worker_name = $(worker).attr('data-worker-name');
            // delete worker
            await puter.workers.delete(worker_name)

            // remove worker card
            remove_worker_card(worker_name);

            try{
                count_workers();
            } catch(err) {
                console.log(err);
            }
        }

        // close 'deleting' modal
        setTimeout(() => {
            puter.ui.hideSpinner();
            if($('.worker-checkbox:checked').length === 0){
                // disable delete button
                $('.delete-workers-btn').addClass('disabled');
                // reset the 'select all' checkbox
                $('.select-all-workers').prop('indeterminate', false);
                $('.select-all-workers').prop('checked', false);
            }
        }, (start_ts - Date.now()) > 500 ? 0 : 500);
    }
})

$(document).on('click', '.options-icon-worker', function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    puter.ui.contextMenu({
        items: [
            {
                label: 'View Logs',
                action: () => {
                    show_worker_logs($(this).attr('data-worker-name'));
                },
            },
            {
                label: 'Delete',
                type: 'danger',
                action: () => {
                    attempt_worker_deletion($(this).attr('data-worker-name'));
                },
            },
        ],
    });
})

let activeLogHandles = {};

function format_log_entry(data) {
    try {
        // If it's a string, try to parse it
        const logData = typeof data === 'string' ? JSON.parse(data) : data;
        
        let formatted = '';
        
        // Format request info
        if (logData.event?.request) {
            const req = logData.event.request;
            const statusCode = logData.event.response?.status || '---';
            const statusColor = statusCode >= 200 && statusCode < 300 ? '#4caf50' : 
                               statusCode >= 400 ? '#f44336' : '#ff9800';
            
            formatted += `<div style="margin-bottom: 8px; padding: 8px; background: #2d2d2d; border-left: 3px solid ${statusColor}; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">`;
            formatted += `<div style="margin-bottom: 6px;"><span style="color: #61afef; font-weight: bold; font-family: monospace;">${html_encode(req.method)}</span> <span style="color: #98c379; font-family: monospace;">${html_encode(req.url)}</span></div>`;
            formatted += `<div style="color: #abb2bf; font-size: 12px; margin-bottom: 6px;">Status: <span style="color: ${statusColor}; font-weight: bold;">${statusCode}</span></div>`;
            
            // Show important headers
            if (req.headers) {
                const importantHeaders = ['user-agent', 'cf-ipcountry', 'cf-connecting-ip', 'x-real-ip', 'content-type', 'authorization'];
                const headerEntries = Object.entries(req.headers).filter(([key]) => 
                    importantHeaders.includes(key.toLowerCase())
                );
                
                if (headerEntries.length > 0) {
                    formatted += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #404040;">`;
                    formatted += `<div style="color: #61afef; font-size: 11px; margin-bottom: 4px;">Key Headers:</div>`;
                    headerEntries.forEach(([key, value]) => {
                        formatted += `<div style="font-size: 11px; color: #858585; margin-left: 8px; font-family: monospace;">`;
                        formatted += `<span style="color: #c678dd; font-family: monospace;">${html_encode(key)}</span>: `;
                        formatted += `<span style="color: #abb2bf; font-family: monospace;">${html_encode(String(value).substring(0, 100))}${String(value).length > 100 ? '...' : ''}</span>`;
                        formatted += `</div>`;
                    });
                    formatted += `</div>`;
                }
                
                // Add expandable section for all headers
                const headerId = `headers-${Math.random().toString(36).substr(2, 9)}`;
                formatted += `<div style="margin-top: 6px;">`;
                formatted += `<span style="color: #61afef; font-size: 11px; cursor: pointer; text-decoration: underline;" onclick="document.getElementById('${headerId}').style.display = document.getElementById('${headerId}').style.display === 'none' ? 'block' : 'none';">Show all headers (${Object.keys(req.headers).length})</span>`;
                formatted += `<div id="${headerId}" style="display: none; margin-top: 4px; padding: 4px; background: #252525; font-size: 10px; max-height: 200px; overflow-y: auto;">`;
                formatted += `<pre style="margin: 0; color: #abb2bf; white-space: pre-wrap; word-break: break-all;">${html_encode(JSON.stringify(req.headers, null, 2))}</pre>`;
                formatted += `</div></div>`;
            }
            
            formatted += `</div>`;
        }
        
        // Format logs array
        if (logData.logs && Array.isArray(logData.logs) && logData.logs.length > 0) {
            logData.logs.forEach(log => {
                const levelColors = {
                    'log': '#61afef',
                    'info': '#56b6c2',
                    'warn': '#e5c07b',
                    'error': '#e06c75',
                    'debug': '#c678dd'
                };
                const levelColor = levelColors[log.level] || '#abb2bf';
                
                formatted += `<div style="margin-bottom: 4px; padding: 6px 12px; background: #262626; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">`;
                formatted += `<span style="color: ${levelColor}; font-weight: bold;">[${log.level.toUpperCase()}]</span> `;
                
                // Show timestamp if available
                if (log.timestamp) {
                    const logTime = new Date(log.timestamp);
                    formatted += `<span style="color: #858585; font-size: 11px;">${logTime.toLocaleTimeString()}.${String(logTime.getMilliseconds()).padStart(3, '0')}</span> `;
                }
                
                // Format the message
                if (Array.isArray(log.message)) {
                    log.message.forEach((msg, idx) => {
                        if (idx > 0) formatted += ' ';
                        if (typeof msg === 'object') {
                            formatted += `<span style="color: #d19a66;">${html_encode(JSON.stringify(msg, null, 2))}</span>`;
                        } else {
                            formatted += `<span style="color: #abb2bf;">${html_encode(String(msg))}</span>`;
                        }
                    });
                } else {
                    formatted += `<span style="color: #abb2bf;">${html_encode(String(log.message))}</span>`;
                }
                formatted += `</div>`;
            });
        }
        
        // Format exceptions
        if (logData.exceptions && Array.isArray(logData.exceptions) && logData.exceptions.length > 0) {
            logData.exceptions.forEach(exception => {
                formatted += `<div style="margin-bottom: 4px; padding: 8px; background: #3d1f1f; border-left: 3px solid #f44336; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">`;
                formatted += `<span style="color: #f44336; font-weight: bold;">⚠ EXCEPTION:</span><br>`;
                formatted += `<pre style="margin: 4px 0 0 0; color: #e06c75; white-space: pre-wrap; word-break: break-all; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">${html_encode(JSON.stringify(exception, null, 2))}</pre>`;
                formatted += `</div>`;
            });
        }
        
        // Show worker name if available
        if (logData.workerName) {
            formatted += `<div style="margin-top: 6px; font-size: 11px; color: #858585; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">Worker: <span style="color: #c678dd; font-family: monospace;">${html_encode(logData.workerName)}</span></div>`;
        }
        
        // Show outcome
        if (logData.outcome) {
            const outcomeColor = logData.outcome === 'ok' ? '#4caf50' : '#e5c07b';
            formatted += `<div style="margin-top: 4px; font-size: 11px; color: #858585; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">Outcome: <span style="color: ${outcomeColor}; font-weight: bold;">${html_encode(logData.outcome)}</span></div>`;
        }
        
        // If nothing was formatted, fall back to JSON
        if (!formatted) {
            formatted = `<pre style="margin: 0; color: #abb2bf; white-space: pre-wrap; word-break: break-all; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">${html_encode(JSON.stringify(logData, null, 2))}</pre>`;
        }
        
        return formatted;
    } catch (err) {
        // If parsing fails, return as plain text
        return `<span style="color: #abb2bf; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">${html_encode(String(data))}</span>`;
    }
}

async function show_worker_logs(worker_name) {
    // Create modal HTML
    const modal_id = `worker-logs-modal-${worker_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Remove existing modal if it exists
    $(`#${modal_id}`).remove();
    
    // Stop existing log handle if it exists
    if (activeLogHandles[worker_name]) {
        activeLogHandles[worker_name].removeEventListener("log", activeLogHandles[worker_name].logHandler);
        activeLogHandles[worker_name] = null;
    }
    
    const modal_html = `
        <div id="${modal_id}" class="worker-logs-modal" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            max-width: 900px;
            max-height: 80vh;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            flex-direction: column;
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Logs: ${html_encode(worker_name)}</h2>
                <button class="close-logs-modal" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                ">&times;</button>
            </div>
            <div class="logs-content" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 13px;
                line-height: 1.5;
                background: #1e1e1e;
                color: #d4d4d4;
            ">
                <div class="log-entries">
                    <div class="waiting-for-logs" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        min-height: 200px;
                        color: #858585;
                        font-style: italic;
                        font-size: 14px;
                    ">Waiting for logs...</div>
                </div>
            </div>
            <div style="
                padding: 15px 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f8f8;
            ">
                <button class="clear-logs-btn" style="
                    padding: 8px 16px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Clear Logs</button>
                <span style="font-size: 12px; color: #666;">Live streaming enabled</span>
            </div>
        </div>
        <div class="worker-logs-backdrop" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        "></div>
    `;
    
    $('body').append(modal_html);
    
    // Get logging handle and start streaming logs
    try {
        const handle = await puter.workers.getLoggingHandle(worker_name);
        
        const logHandler = (event) => {
            // Remove waiting message on first log entry
            $(`#${modal_id} .waiting-for-logs`).remove();
            
            const timestamp = new Date().toLocaleTimeString();
            const formatted_content = format_log_entry(event.data);
            const log_entry = `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">
                <div style="color: #858585; font-size: 11px; margin-bottom: 4px;">[${timestamp}]</div>
                ${formatted_content}
            </div>`;
            $(`#${modal_id} .log-entries`).append(log_entry);
            
            // Auto-scroll to bottom
            const logsContent = $(`#${modal_id} .logs-content`)[0];
            logsContent.scrollTop = logsContent.scrollHeight;
        };
        
        handle.addEventListener("log", logHandler);
        
        // Store handle for cleanup
        activeLogHandles[worker_name] = handle;
        activeLogHandles[worker_name].logHandler = logHandler;
        
    } catch (err) {
        $(`#${modal_id} .log-entries`).append(`<div style="color: #f44336; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;">Error: ${html_encode(err.message)}</div>`);
    }
    
    // Close modal handlers
    $(document).on('click', `#${modal_id} .close-logs-modal, .worker-logs-backdrop`, function(e) {
        if (e.target === this) {
            // Clean up log handle
            if (activeLogHandles[worker_name]) {
                activeLogHandles[worker_name].removeEventListener("log", activeLogHandles[worker_name].logHandler);
                activeLogHandles[worker_name] = null;
            }
            $(`#${modal_id}, .worker-logs-backdrop`).remove();
        }
    });
    
    // Clear logs handler
    $(document).on('click', `#${modal_id} .clear-logs-btn`, function() {
        $(`#${modal_id} .log-entries`).empty();
        // Show waiting message again after clearing
        $(`#${modal_id} .log-entries`).html(`
            <div class="waiting-for-logs" style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                min-height: 200px;
                color: #858585;
                font-style: italic;
                font-size: 14px;
            ">Waiting for logs...</div>
        `);
    });
}

async function attempt_worker_deletion(worker_name) {
    // confirm delete
    const alert_resp = await puter.ui.alert(`Are you sure you want to premanently delete <strong>${html_encode(worker_name)}</strong>?`,
        [
            {
                label: 'Yes, delete permanently',
                value: 'delete',
                type: 'danger',
            },
            {
                label: 'Cancel'
            },
        ]
    );

    if (alert_resp === 'delete') {
        // remove worker card and update worker count
        remove_worker_card(worker_name);

        // delete worker
        puter.workers.delete(worker_name).then().catch(async (err) => {
            puter.ui.alert(err?.message, [
                {
                    label: 'Ok',
                },
            ]);
        })
    }
}

$(document).on('click', '.worker-file-path', function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const file_path = $(this).attr('data-worker-file-path');

    if(file_path){
        puter.ui.launchApp({
            name: 'editor',
            file_paths: [file_path],
        });
    }
})

export default init_workers;