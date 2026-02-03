// ==========================================
// نظام سجل النشاط المحسن وعرضه النشاط
// ==========================================

class ActivityLogger {
    constructor() {
        this.logTypes = {
            ADD: { text: 'إضافة', color: 'green', icon: 'fa-plus-circle', class: 'add' },
            EDIT: { text: 'تعديل', color: 'blue', icon: 'fa-edit', class: 'edit' },
            DELETE: { text: 'حذف', color: 'red', icon: 'fa-trash-alt', class: 'delete' },
            RESTORE: { text: 'استعادة', color: 'yellow', icon: 'fa-undo', class: 'restore' }
        };
        
        this.ACTIVITY_LOG_PATH = 'activityLog1';
        this.DELETED_CONTENT_PATH = 'deletedContent1';
    }

    async logActivity(type, data) {
        if (!appState.currentUser) {
            console.warn('لا يمكن تسجيل النشاط بدون مستخدم مسجل');
            return;
        }

        try {
            const activityData = {
                type: type,
                userId: appState.currentUser.id,
                userName: appState.currentUser.name,
                userEmail: appState.currentUser.email,
                userRole: appState.currentUser.role,
                unitId: data.unitId,
                unitTitle: data.unitTitle,
                questionIndex: data.questionIndex,
                questionText: data.questionText?.substring(0, 150),
                oldData: data.oldData ? this.sanitizeData(data.oldData) : null,
                newData: data.newData ? this.sanitizeData(data.newData) : null,
                timestamp: Date.now(),
                localTime: new Date().toLocaleString('ar-SA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                })
            };

            await database.ref(this.ACTIVITY_LOG_PATH).push(activityData);
            
            if (appState.currentView === 'activityLog') {
                await this.loadActivityLog();
            }
            
        } catch (error) {
            console.error('خطأ في تسجيل النشاط:', error);
        }
    }

    sanitizeData(data) {
        if (typeof data === 'object') {
            const sanitized = { ...data };
            
            if (sanitized.answer && sanitized.answer.length > 300) {
                sanitized.answer = sanitized.answer.substring(0, 300) + '...';
            }
            
            if (sanitized.question && sanitized.question.length > 200) {
                sanitized.question = sanitized.question.substring(0, 200) + '...';
            }
            
            if (sanitized.options && Array.isArray(sanitized.options)) {
                sanitized.options = sanitized.options.map(opt => 
                    opt.length > 80 ? opt.substring(0, 80) + '...' : opt
                );
            }
            
            return sanitized;
        }
        return data;
    }

    async saveDeletedContent(unit, question, questionIndex) {
        try {
            const deletedData = {
                unitId: unit.id,
                unitTitle: unit.title,
                unitType: unit.type,
                questionIndex: questionIndex,
                questionData: question,
                deletedBy: {
                    userId: appState.currentUser.id,
                    userName: appState.currentUser.name,
                    userEmail: appState.currentUser.email,
                    userRole: appState.currentUser.role
                },
                deletedAt: Date.now(),
                deletedAtLocal: new Date().toLocaleString('ar-SA'),
                canRestore: true
            };

            await database.ref(`${this.DELETED_CONTENT_PATH}/${unit.id}/${questionIndex}`).set(deletedData);
            
        } catch (error) {
            console.error('خطأ في حفظ المحتوى المحذوف:', error);
        }
    }

    async getActivityLog(filters = {}) {
        try {
            const snapshot = await database.ref(this.ACTIVITY_LOG_PATH).orderByChild('timestamp').once('value');
            const logs = [];
            
            snapshot.forEach(child => {
                const log = { id: child.key, ...child.val() };
                
                if (filters.type && filters.type !== 'all' && log.type !== filters.type) {
                    return;
                }
                
                if (filters.userId && filters.userId !== 'all' && log.userId !== filters.userId) {
                    return;
                }
                
                if (filters.unitId && filters.unitId !== 'all' && String(log.unitId) !== String(filters.unitId)) {
                    return;
                }
                
                logs.push(log);
            });
            
            return logs.reverse();
        } catch (error) {
            console.error('خطأ في جلب سجل النشاط:', error);
            return [];
        }
    }

        async restoreDeletedContent(unitId, questionIndex) {
        try {
            const snapshot = await database.ref(`${this.DELETED_CONTENT_PATH}/${unitId}/${questionIndex}`).once('value');
            const deletedData = snapshot.val();
            
            // 1. التحقق مما إذا كان المحتوى موجوداً فعلاً
            if (!deletedData) {
                // بدلاً من throw error، نظهر رسالة تنبيه للمستخدم وننهي الدالة
                showToast('هذا المحتوى تم استعادته مسبقاً أو لم يعد متاحاً في سلة المحذوفات', 'info');
                return false; // نرجع false للإشارة إلى أن الاستعادة لم تتم لأنها غير موجودة أصلاً
            }

            const unit = unitsData.find(u => u.id === parseInt(unitId));
            if (!unit) {
                throw new Error('الوحدة غير موجودة');
            }

            const questions = getUnitQuestions(unit.type);
            
            // 2. إضافة السؤال في مكانه الأصلي
            questions.splice(questionIndex, 0, deletedData.questionData);
            updateUnitQuestions(unit.type, questions);

            await saveQuestionsToFirebase();

            // 3. تسجيل نشاط الاستعادة
            await this.logActivity('RESTORE', {
                unitId: unitId,
                unitTitle: unit.title,
                questionIndex: questionIndex,
                questionText: deletedData.questionData.question?.substring(0, 100) || 'سؤال محذوف'
            });

            // 4. حذف البيانات من سلة المحذوفات بعد نجاح الاستعادة
            await database.ref(`${this.DELETED_CONTENT_PATH}/${unitId}/${questionIndex}`).remove();

            return true;
            
        } catch (error) {
            // فقط الأخطاء التقنية الحقيقية تظهر هنا
            console.error('خطأ فني أثناء محاولة الاستعادة:', error);
            throw error;
        }
    }


    async getDeletedContent() {
        try {
            const snapshot = await database.ref(this.DELETED_CONTENT_PATH).once('value');
            const deletedItems = [];
            
            snapshot.forEach(unitSnapshot => {
                unitSnapshot.forEach(questionSnapshot => {
                    deletedItems.push({
                        id: questionSnapshot.key,
                        unitId: unitSnapshot.key,
                        ...questionSnapshot.val()
                    });
                });
            });
            
            return deletedItems;
        } catch (error) {
            console.error('خطأ في جلب المحتوى المحذوف:', error);
            return [];
        }
    }

    async clearOldLogs(daysToKeep = 30) {
        try {
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            const snapshot = await database.ref(this.ACTIVITY_LOG_PATH).orderByChild('timestamp').endAt(cutoffTime).once('value');
            
            const updates = {};
            snapshot.forEach(child => {
                updates[`${this.ACTIVITY_LOG_PATH}/${child.key}`] = null;
            });
            
            if (Object.keys(updates).length > 0) {
                await database.ref().update(updates);
                return Object.keys(updates).length;
            }
            
            return 0;
        } catch (error) {
            console.error('خطأ في مسح السجلات القديمة:', error);
            return -1;
        }
    }
}

// ==========================================
// إدارة حالة سجل النشاط
// ==========================================

let activityLogState = {
    logs: [],
    filteredLogs: [],
    filters: {
        type: 'all',
        userId: 'all',
        unitId: 'all'
    },
    usersList: [],
    unitsList: []
};

// ==========================================
// دوال سجل النشاط - تحميل وعرض
// ==========================================

async function loadActivityLog() {
    try {
        showLoadingActivityLog(true);
        
        // جلب سجل النشاط
        activityLogState.logs = await activityLogger.getActivityLog(activityLogState.filters);
        activityLogState.filteredLogs = [...activityLogState.logs];
        
        // جلب قائمة المستخدمين للفلترة
        await loadUsersForActivityLog();
        
        // جلب قائمة الوحدات للفلترة
        await loadUnitsForActivityLog();
        
        // عرض السجلات
        renderActivityLogTable();
        
    } catch (error) {
        console.error('خطأ في تحميل سجل النشاط:', error);
        showToast('حدث خطأ في تحميل سجل النشاط', 'error');
    } finally {
        showLoadingActivityLog(false);
    }
}

async function loadUsersForActivityLog() {
    try {
        const snapshot = await database.ref(USERS_PATH).once('value');
        activityLogState.usersList = [];
        
        snapshot.forEach(child => {
            const user = child.val();
            activityLogState.usersList.push({
                id: child.key,
                name: user.name,
                email: user.email,
                role: user.role
            });
        });
        
        // تحديث قائمة المستخدمين في الفلتر
        updateUserFilterOptions();
        
    } catch (error) {
        console.error('خطأ في جلب قائمة المستخدمين:', error);
    }
}

async function loadUnitsForActivityLog() {
    activityLogState.unitsList = unitsData.map(unit => ({
        id: unit.id,
        title: unit.title,
        type: unit.type
    }));
    
    // تحديث قائمة الوحدات في الفلتر
    updateUnitFilterOptions();
}

function updateUserFilterOptions() {
    const select = document.getElementById('activityUserFilter');
    if (!select) return;
    
    // حفظ القيمة المحددة حالياً
    const currentValue = select.value;
    
    // إضافة الخيارات
    select.innerHTML = `
        <option value="all">جميع المستخدمين</option>
        ${activityLogState.usersList.map(user => `
            <option value="${user.id}">${user.name} (${ROLES[user.role]?.label || user.role})</option>
        `).join('')}
    `;
    
    // استعادة القيمة المحددة
    if (currentValue) {
        select.value = currentValue;
    }
}

function updateUnitFilterOptions() {
    const select = document.getElementById('activityUnitFilter');
    if (!select) return;
    
    // حفظ القيمة المحددة حالياً
    const currentValue = select.value;
    
    // إضافة الخيارات
    select.innerHTML = `
        <option value="all">جميع الوحدات</option>
        ${activityLogState.unitsList.map(unit => `
            <option value="${unit.id}">${unit.title}</option>
        `).join('')}
    `;
    
    // استعادة القيمة المحددة
    if (currentValue) {
        select.value = currentValue;
    }
}

function showLoadingActivityLog(show) {
    const loadingEl = document.getElementById('loadingActivityLog');
    const noLogsEl = document.getElementById('noActivityLogMessage');
    const tableBody = document.getElementById('activityLogTableBody');
    
    if (show) {
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (noLogsEl) noLogsEl.classList.add('hidden');
        if (tableBody) tableBody.classList.add('hidden');
    } else {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (tableBody) tableBody.classList.remove('hidden');
    }
}

function renderActivityLogTable() {
    const tbody = document.getElementById('activityLogTableBody');
    const noLogsEl = document.getElementById('noActivityLogMessage');
    
    if (!tbody) return;
    
    if (activityLogState.filteredLogs.length === 0) {
        tbody.innerHTML = '';
        if (noLogsEl) noLogsEl.classList.remove('hidden');
        return;
    }
    
    if (noLogsEl) noLogsEl.classList.add('hidden');
    
    tbody.innerHTML = activityLogState.filteredLogs.map(log => {
        const logType = activityLogger.logTypes[log.type] || activityLogger.logTypes.EDIT;
        
        // تنسيق التاريخ
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString('ar-SA', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // بناء شارة النشاط
        const badgeClass = `activity-badge activity-badge-${logType.class}`;
        
        // تفاصيل النشاط
        const details = buildActivityDetails(log);
        
        // أزرار الإجراءات (للحذف والاستعادة)
        const actions = buildActivityActions(log);
        
        return `
            <tr class="activity-log-row border-b border-gray-200 dark:border-gray-700">
                <!-- النوع -->
                <td class="px-4 py-3">
                    <span class="${badgeClass}">
                        <i class="fas ${logType.icon}"></i>
                        ${logType.text}
                    </span>
                </td>
                
                <!-- التفاصيل -->
                <td class="px-4 py-3 min-w-[320px]">
                    ${details}
                </td>
                
                <!-- الوحدة -->
                <td class="px-4 py-3 min-w-[150px]">
                    <div class="space-y-1">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                            ${log.unitTitle}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            سؤال ${parseInt(log.questionIndex) + 1}
                        </div>
                    </div>
                </td>
                
                <!-- المستخدم -->
                <td class="px-4 py-3 min-w-[140px]">
                    <div class="flex items-center gap-2">
                        ${getRoleIconHTML(log.userRole, 'text-xs')}
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-gray-900 dark:text-white truncate" title="${log.userName}">
                                ${log.userName}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate" title="${log.userEmail}">
                                ${log.userEmail}
                            </div>
                        </div>
                    </div>
                </td>
                
                <!-- التاريخ -->
                <td class="px-4 py-3 min-w-[170px]">
                    <div class="space-y-1">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                            ${dateStr}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            ${timeStr}
                        </div>
                    </div>
                </td>
                
                <!-- الإجراء -->
                <td class="px-4 py-3 min-w-[120px]">
                    ${actions}
                </td>
            </tr>
        `;
    }).join('');
}

function buildActivityDetails(log) {
    let details = '';
    const maxLength = 80;
    
    if (log.questionText) {
        const questionText = log.questionText.length > maxLength 
            ? log.questionText.substring(0, maxLength) + '...' 
            : log.questionText;
        details += `<div class="mb-1 text-sm font-medium text-gray-900 dark:text-white">${questionText}</div>`;
    }
    
    if (log.type === 'EDIT' && log.oldData) {
        details += `
            <div class="mt-2">
                <button type="button" 
                        onclick="toggleActivityDetails(this)" 
                        class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1">
                    <i class="fas fa-eye"></i>
                    عرض التغييرات
                </button>
                <div class="activity-details hidden mt-2">
                    <div class="mb-2 text-xs font-bold text-gray-600 dark:text-gray-400">التغييرات:</div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <div class="text-xs text-red-600 dark:text-red-400 mb-1 font-bold">قبل التعديل</div>
                            ${renderActivityData(log.oldData)}
                        </div>
                        <div>
                            <div class="text-xs text-green-600 dark:text-green-400 mb-1 font-bold">بعد التعديل</div>
                            ${renderActivityData(log.newData)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (log.type === 'DELETE' && log.oldData) {
        details += `
            <div class="mt-2">
                <button type="button" 
                        onclick="toggleActivityDetails(this)" 
                        class="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1">
                    <i class="fas fa-trash"></i>
                    عرض المحتوى المحذوف
                </button>
                <div class="activity-details hidden mt-2">
                    <div class="mb-2 text-xs font-bold text-gray-600 dark:text-gray-400">المحتوى المحذوف:</div>
                    ${renderActivityData(log.oldData)}
                </div>
            </div>
        `;
    } else if (log.type === 'ADD' && log.newData) {
        details += `
            <div class="mt-2">
                <button type="button" 
                        onclick="toggleActivityDetails(this)" 
                        class="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 flex items-center gap-1">
                    <i class="fas fa-plus"></i>
                    عرض المحتوى المضاف
                </button>
                <div class="activity-details hidden mt-2">
                    <div class="mb-2 text-xs font-bold text-gray-600 dark:text-gray-400">المحتوى المضاف:</div>
                    ${renderActivityData(log.newData)}
                </div>
            </div>
        `;
    }
    
    return details || '<span class="text-gray-500 dark:text-gray-400 text-sm">لا توجد تفاصيل إضافية</span>';
}

function renderActivityData(data) {
    if (!data) return '<span class="text-gray-400 text-xs">لا توجد بيانات</span>';
    
    let html = '<div class="space-y-1 text-xs">';
    
    if (data.question) {
        html += `<div><span class="font-medium text-gray-600 dark:text-gray-400">سؤال:</span> <span class="text-gray-800 dark:text-gray-300">${data.question.substring(0, 80)}${data.question.length > 80 ? '...' : ''}</span></div>`;
    }
    
    if (data.answer) {
        html += `<div><span class="font-medium text-gray-600 dark:text-gray-400">إجابة:</span> <span class="text-gray-800 dark:text-gray-300">${data.answer.substring(0, 60)}${data.answer.length > 60 ? '...' : ''}</span></div>`;
    }
    
    if (data.options && Array.isArray(data.options)) {
        html += `<div><span class="font-medium text-gray-600 dark:text-gray-400">خيارات:</span> <span class="text-gray-800 dark:text-gray-300">${data.options.slice(0, 2).join('، ')}${data.options.length > 2 ? '...' : ''}</span></div>`;
    }
    
    if (data.answerIndex !== undefined) {
        html += `<div><span class="font-medium text-gray-600 dark:text-gray-400">رقم الإجابة:</span> <span class="text-gray-800 dark:text-gray-300">${data.answerIndex + 1}</span></div>`;
    }
    
    if (data.answers && Array.isArray(data.answers)) {
        html += `<div><span class="font-medium text-gray-600 dark:text-gray-400">الإجابات:</span> <span class="text-gray-800 dark:text-gray-300">${data.answers.map(a => a + 1).join('، ')}</span></div>`;
    }
    
    html += '</div>';
    return html;
}

function buildActivityActions(log) {
    let actions = '';
    
    if (log.type === 'DELETE') {
        // للأسئلة المحذوفة، نعرض زر الاستعادة
        actions = `
            <button onclick="restoreDeletedItem('${log.unitId}', '${log.questionIndex}')" 
                    class="activity-action-btn restore-btn w-full justify-center" 
                    title="استعادة المحتوى المحذوف">
                <i class="fas fa-undo"></i>
                استعادة
            </button>
        `;
    } else if (checkPermission('canDeleteActivityLog')) {
        // للمحتويات التي يمكن حذفها بشكل نهائي
        actions = `
            <button onclick="deleteActivityLog('${log.id}')" 
                    class="activity-action-btn delete-permanent-btn w-full justify-center" 
                    title="حذف السجل نهائياً">
                <i class="fas fa-trash"></i>
                حذف
            </button>
        `;
    } else {
        actions = '<span class="text-gray-500 dark:text-gray-400 text-sm">-</span>';
    }
    
    return actions;
}

async function restoreDeletedItem(unitId, questionIndex) {
    if (!checkPermission('canDeleteActivityLog')) {
        showToast('ليس لديك صلاحية لاستعادة المحتوى المحذوف', 'error');
        return;
    }
    
    if (confirm('هل تريد استعادة هذا المحتوى المحذوف؟')) {
        try {
            showLoadingActivityLog(true);
            
            const success = await activityLogger.restoreDeletedContent(unitId, questionIndex);
            
            if (success) {
                showToast('تم استعادة المحتوى بنجاح', 'success');
                await loadActivityLog();
            }
            
        } catch (error) {
            console.error('خطأ في استعادة المحتوى:', error);
            showToast('حدث خطأ أثناء استعادة المحتوى', 'error');
        } finally {
            showLoadingActivityLog(false);
        }
    }
}

async function deleteActivityLog(logId) {
    if (!checkPermission('canDeleteActivityLog')) {
        showToast('ليس لديك صلاحية لحذف سجلات النشاط', 'error');
        return;
    }
    
    if (confirm('هل تريد حذف هذا السجل نهائياً؟')) {
        try {
            showLoadingActivityLog(true);
            
            await database.ref(`${activityLogger.ACTIVITY_LOG_PATH}/${logId}`).remove();
            
            showToast('تم حذف السجل بنجاح', 'success');
            await loadActivityLog();
            
        } catch (error) {
            console.error('خطأ في حذف السجل:', error);
            showToast('حدث خطأ أثناء حذف السجل', 'error');
        } finally {
            showLoadingActivityLog(false);
        }
    }
}

function applyActivityFilters() {
    const typeFilter = document.getElementById('activityTypeFilter')?.value || 'all';
    const userFilter = document.getElementById('activityUserFilter')?.value || 'all';
    const unitFilter = document.getElementById('activityUnitFilter')?.value || 'all';
    
    activityLogState.filters = {
        type: typeFilter,
        userId: userFilter,
        unitId: unitFilter
    };
    
    loadActivityLog();
}

async function clearActivityLogConfirmation() {
    if (!checkPermission('canDeleteActivityLog')) {
        showToast('ليس لديك صلاحية لمسح سجل النشاط', 'error');
        return;
    }
    
    if (confirm('⚠️  تحذير: هذه العملية ستمسح جميع سجلات النشاط.\nهل أنت متأكد من رغبتك في مسح سجل النشاط كاملاً؟')) {
        try {
            showLoadingActivityLog(true);
            
            await database.ref(activityLogger.ACTIVITY_LOG_PATH).remove();
            
            showToast('تم مسح سجل النشاط بنجاح', 'success');
            await loadActivityLog();
            
        } catch (error) {
            console.error('خطأ في مسح سجل النشاط:', error);
            showToast('حدث خطأ أثناء مسح سجل النشاط', 'error');
        } finally {
            showLoadingActivityLog(false);
        }
    }
}

// دالة مساعدة لإظهار/إخفاء التفاصيل
function toggleActivityDetails(button) {
    const detailsDiv = button.nextElementSibling;
    if (detailsDiv.classList.contains('hidden')) {
        detailsDiv.classList.remove('hidden');
        button.innerHTML = '<i class="fas fa-eye-slash"></i> إخفاء التفاصيل';
    } else {
        detailsDiv.classList.add('hidden');
        const icon = button.classList.contains('text-red-600') ? 'fa-trash' : 
                     button.classList.contains('text-green-600') ? 'fa-plus' : 'fa-eye';
        button.innerHTML = `<i class="fas ${icon}"></i> عرض التفاصيل`;
    }
}

// ==========================================
// تهيئة أحداث سجل النشاط
// ==========================================

function setupActivityLogEvents() {
    // تنظيف أي أحداث سابقة
    document.getElementById('activityTypeFilter')?.removeEventListener('change', applyActivityFilters);
    document.getElementById('activityUserFilter')?.removeEventListener('change', applyActivityFilters);
    document.getElementById('activityUnitFilter')?.removeEventListener('change', applyActivityFilters);
    document.getElementById('clearActivityLogBtn')?.removeEventListener('click', clearActivityLogConfirmation);
    
    // إضافة الأحداث الجديدة
    document.getElementById('activityTypeFilter')?.addEventListener('change', applyActivityFilters);
    document.getElementById('activityUserFilter')?.addEventListener('change', applyActivityFilters);
    document.getElementById('activityUnitFilter')?.addEventListener('change', applyActivityFilters);
    document.getElementById('clearActivityLogBtn')?.addEventListener('click', clearActivityLogConfirmation);
}

// ==========================================
// إنشاء مثيل ActivityLogger
// ==========================================

const activityLogger = new ActivityLogger();