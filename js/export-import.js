// ==========================================
// نظام التصدير والاستيراد الموحد - مع دمج البيانات
// ==========================================

// تعريف المتغيرات العامة
let exportManager;

// ==========================================
// الكلاس الرئيسي لإدارة التصدير والاستيراد
// ==========================================

class ExportImportManager {
    constructor() {
      
        this.backupKeyPrefix = STORAGE_KEYS.BACKUPS || 'backup_'; 
        
        this.maxBackups = 5;
        this.appName = this.getAppName();
        this.importMode = 'merge';
    }
    


    // ==========================================
    // التهيئة والإعداد
    // ==========================================
    
    init() {
        console.log('✅ تهيئة نظام التصدير والاستيراد...');
        this.setupFileUpload();
        this.checkForBackups();
        this.attachEventListeners();
        this.redefineExportButtons();
        this.setupImportModeSelector();
        
        console.log('✅ نظام التصدير والاستيراد جاهز');
    }

    setupFileUpload() {
        const dropZone = document.getElementById('fileDropZone');
        const fileInput = document.getElementById('jsonFileInput');
        
        if (!dropZone || !fileInput) {
            console.warn('⚠️ عناصر رفع الملف غير موجودة');
            return;
        }

        // النقر على منطقة الرفع
        dropZone.addEventListener('click', () => fileInput.click());

        // تغيير الملف
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // سحب وإفلات الملفات
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', this.handleFileDrop.bind(this), false);

        // تحديث حالة زر الاستيراد
        const confirmBox = document.getElementById('confirmImport');
        if (confirmBox) {
            confirmBox.addEventListener('change', () => this.updateImportButtonState());
        }
    }

    setupImportModeSelector() {
        // إنشاء عناصر اختيار وضع الاستيراد
        const importSection = document.getElementById('fileDropZone')?.parentElement;
        if (!importSection) return;

        // التحقق مما إذا كان عنصر اختيار الوضع موجود بالفعل
        if (!document.getElementById('importModeSelector')) {
            const modeSelector = `
                <div class="mb-4" id="importModeSelector">
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        <i class="fas fa-cog ml-1"></i> وضع الاستيراد
                    </label>
                    <div class="flex flex-col gap-3">
                        <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input type="radio" name="importMode" value="merge" checked 
                                   class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                            <div class="flex-1">
                                <div class="font-medium text-gray-900 dark:text-white">دمج البيانات</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    إضافة الأسئلة الجديدة مع الاحتفاظ بالقديمة
                                </div>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <i class="fas fa-plus text-green-600"></i>
                            </div>
                        </label>
                        
                        <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input type="radio" name="importMode" value="replace" 
                                   class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                            <div class="flex-1">
                                <div class="font-medium text-gray-900 dark:text-white">استبدال البيانات</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    حذف جميع الأسئلة الحالية واستبدالها
                                </div>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <i class="fas fa-exchange-alt text-red-600"></i>
                            </div>
                        </label>
                    </div>
                </div>
            `;
            
            const dropZone = document.getElementById('fileDropZone');
            if (dropZone) {
                dropZone.insertAdjacentHTML('beforebegin', modeSelector);
            }
        }

        // تحديث الوضع عند التغيير
        document.querySelectorAll('input[name="importMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.importMode = e.target.value;
                this.updateImportModeUI();
            });
        });

        this.updateImportModeUI();
    }

    updateImportModeUI() {
        const mergeOption = document.querySelector('input[name="importMode"][value="merge"]');
        const replaceOption = document.querySelector('input[name="importMode"][value="replace"]');
        
        if (this.importMode === 'merge') {
            document.getElementById('confirmImportLabel')?.parentElement?.classList.remove('hidden');
            document.getElementById('confirmImport')?.parentElement?.classList.remove('hidden');
        } else {
            document.getElementById('confirmImportLabel')?.parentElement?.classList.add('hidden');
            document.getElementById('confirmImport')?.parentElement?.classList.add('hidden');
        }
    }

    attachEventListeners() {
        // ربط الأزرار بعد إعادة تعريفها
        setTimeout(() => {
            this.attachButton('#importBtn', () => this.importFromJSON());
        }, 100);
    }

    attachButton(selector, handler) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.onclick = handler;
        }
    }

    // ==========================================
    // التصدير إلى JSON (التنسيق المطلوب)
    // ==========================================
    
    exportToJSON() {
        try {
            const exportData = this.prepareExportData();
            const date = new Date().toISOString().split('T')[0];
            const filename = `${this.appName}_export_${date}.json`;
            
            this.downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
            showToast('✅ تم تصدير البيانات بتنسيق JSON', 'success');
            
        } catch (error) {
            console.error('❌ خطأ في التصدير:', error);
            showToast('❌ حدث خطأ أثناء التصدير', 'error');
        }
    }

    prepareExportData() {
        console.log('📦 تحضير بيانات التصدير...');
        return {
            units: unitsData.map(unit => ({
                id: unit.id,
                title: unit.title,
                type: unit.type,
                icon: unit.icon || '📚',
                questions: this.getUnitQuestionsForExport(unit)
            })),
            metadata: {
                appName: this.appName,
                exportDate: new Date().toISOString(),
                totalUnits: unitsData.length,
                totalQuestions: this.calculateTotalQuestions()
            }
        };
    }

    getUnitQuestionsForExport(unit) {
        const questions = unit.questions || [];
        
        // للأسئلة المقالية (qa-display)
        if (unit.type === 'qa-display') {
            let questionCounter = 0;
            
            return questions.map((item) => {
                // العناوين والملاحظات
                if (item.type === 'header' || item.type === 'note') {
                    return {
                        type: item.type,
                        text: item.text || ''
                    };
                }
                
                // الأسئلة المقالية
                questionCounter++;
                const questionId = questionCounter <= 2 ? `qa_${questionCounter}` : questionCounter.toString();
                
                return {
                    id: questionId,
                    type: item.type || 'qa',
                    question: item.question || '',
                    answer: item.answer || '',
                    section: item.section || '',
                    explanation: item.explanation || '',
                    page: item.page || ''
                };
            });
        }
        
        // لبقية أنواع الأسئلة مع الترتيب الدقيق
        return questions.map((item, index) => {
            const questionId = (index + 1).toString();
            
            // الصح/خطأ
            if (unit.type === 'mcq-single-tf') {
                return {
                    id: questionId,
                    question: item.question || '',
                    options: item.options || ["صح", "خطأ"],
                    answerIndex: item.answerIndex || 0,
                    explanation: item.explanation || '',
                    page: item.page || ''
                };
            }
            
            // الاختيار الواحد
            if (unit.type === 'mcq-single') {
                return {
                    id: questionId,
                    question: item.question || '',
                    options: item.options || [],
                    answerIndex: item.answerIndex || 0,
                    explanation: item.explanation || '',
                    page: item.page || ''
                };
            }
            
            // الاختيار المتعدد - هنا الترتيب المطلوب
            if (unit.type === 'mcq-multi') {
                return {
                    id: questionId,
                    question: item.question || '',
                    options: item.options || [],
                    answers: item.answers || [],
                    explanation: item.explanation || '',
                    page: item.page || ''
                };
            }
            
            // النوع العام
            return {
                id: questionId,
                question: item.question || '',
                explanation: item.explanation || '',
                page: item.page || ''
            };
        });
    }

    // ==========================================
    // التصدير إلى Excel (مع علامات ✓)
    // ==========================================
    
    exportToExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showToast('❌ مكتبة Excel غير متوفرة', 'error');
                return;
            }

            const wb = XLSX.utils.book_new();
            const sheets = this.prepareExcelSheets();
            
            sheets.forEach(sheet => {
                if (sheet.data && sheet.data.length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
                    
                    // ضبط عرض الأعمدة
                    const colWidths = sheet.data[0].map((_, i) => ({
                        wch: Math.max(...sheet.data.map(row => 
                            (row[i] || '').toString().length
                        )) + 2
                    }));
                    ws['!cols'] = colWidths;
                    
                    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
                }
            });

            const date = new Date().toISOString().split('T')[0];
            const filename = `${this.appName}_export_${date}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            showToast('✅ تم تصدير البيانات إلى Excel', 'success');
            
        } catch (error) {
            console.error('❌ خطأ في تصدير Excel:', error);
            showToast('❌ حدث خطأ أثناء تصدير Excel', 'error');
        }
    }

    prepareExcelSheets() {
        console.log('📊 تحضير أوراق Excel...');
        return [
            { 
                name: 'صح وخطأ', 
                data: this.convertToExcelFormat(trueFalseQuestionsData, 'tf') 
            },
            { 
                name: 'اختيار وحيد', 
                data: this.convertToExcelFormat(mcqQuestionsData, 'mcq') 
            },
            { 
                name: 'اختيار متعدد', 
                data: this.convertToExcelFormat(multiSelectQuestionsData, 'multi') 
            },
            { 
                name: 'أسئلة مقالية', 
                data: this.convertToExcelFormat(qaQuestionsData, 'qa') 
            }
        ];
    }

    convertToExcelFormat(data, type) {
        const worksheetData = [];
        
        switch(type) {
            case 'tf':
                worksheetData.push(['ID', 'السؤال', 'الإجابة', 'الصفحة', 'الشرح']);
                data.forEach((item, index) => {
                    worksheetData.push([
                        (index + 1).toString(),
                        item.question,
                        item.answerIndex === 0 ? 'صح' : 'خطأ',
                        item.page || '',
                        item.explanation || ''
                    ]);
                });
                break;
                
            case 'mcq':
                const maxOptions = Math.max(...data.map(item => (item.options || []).length), 4);
                const mcqHeader = ['ID', 'السؤال'];
                for (let i = 0; i < maxOptions; i++) {
                    mcqHeader.push(`الخيار ${i + 1}`);
                }
                mcqHeader.push('الصفحة', 'الشرح');
                worksheetData.push(mcqHeader);
                
                data.forEach((item, index) => {
                    const options = item.options || [];
                    const row = [(index + 1).toString(), item.question];
                    
                    for (let i = 0; i < maxOptions; i++) {
                        if (i < options.length) {
                            const isCorrect = i === item.answerIndex;
                            row.push(isCorrect ? `${options[i]} ✅` : options[i]);
                        } else {
                            row.push('');
                        }
                    }
                    
                    row.push(item.page || '', item.explanation || '');
                    worksheetData.push(row);
                });
                break;
                
            case 'multi':
                const maxOptionsMulti = Math.max(...data.map(item => (item.options || []).length), 4);
                const multiHeader = ['ID', 'السؤال'];
                for (let i = 0; i < maxOptionsMulti; i++) {
                    multiHeader.push(`الخيار ${i + 1}`);
                }
                multiHeader.push('الإجابات الصحيحة', 'الصفحة', 'الشرح');
                worksheetData.push(multiHeader);
                
                data.forEach((item, index) => {
                    const options = item.options || [];
                    const answers = item.answers || [];
                    const row = [(index + 1).toString(), item.question];
                    
                    for (let i = 0; i < maxOptionsMulti; i++) {
                        if (i < options.length) {
                            const isCorrect = answers.includes(i);
                            row.push(isCorrect ? `${options[i]} ✅` : options[i]);
                        } else {
                            row.push('');
                        }
                    }
                    
                    const correctAnswersText = answers.map(a => a + 1).join('، ');
                    row.push(correctAnswersText);
                    row.push(item.page || '');
                    row.push(item.explanation || '');
                    
                    worksheetData.push(row);
                });
                break;
                
            case 'qa':
                worksheetData.push(['النوع', 'النص', 'الإجابة', 'القسم', 'الصفحة', 'الشرح']);
                let qaCounter = 0;
                data.forEach((item) => {
                    if (item.type === 'header') {
                        worksheetData.push(['عنوان', item.text || '', '', '', '', '']);
                    } else if (item.type === 'note') {
                        worksheetData.push(['ملاحظة', item.text || '', '', '', '', '']);
                    } else {
                        qaCounter++;
                        worksheetData.push([
                            'سؤال مقالي',
                            item.question || '',
                            item.answer || '',
                            item.section || '',
                            item.page || '',
                            item.explanation || ''
                        ]);
                    }
                });
                break;
        }
        
        return worksheetData;
    }

    // ==========================================
    // الاستيراد من JSON مع دمج البيانات
    // ==========================================
    
    async importFromJSON() {
        const fileInput = document.getElementById('jsonFileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            showToast('❌ يرجى اختيار ملف JSON أولاً', 'error');
            return;
        }

        // الحصول على وضع الاستيراد
        this.importMode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';

        const importBtn = document.getElementById('importBtn');
        if (!importBtn) return;

        // تغيير حالة الزر
        importBtn.disabled = true;
        const originalHTML = importBtn.innerHTML;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاستيراد...';

        try {
            // رسالة تأكيد حسب الوضع
            let confirmMessage = '';
            if (this.importMode === 'replace') {
                confirmMessage = '⚠️ سيتم استيراد البيانات واستبدال جميع الأسئلة الحالية. هل تريد المتابعة؟';
            } else {
                confirmMessage = '⚠️ سيتم دمج الأسئلة الجديدة مع الأسئلة الحالية. هل تريد المتابعة؟';
            }

            if (!confirm(confirmMessage)) {
                this.resetImport();
                return;
            }

            // قراءة الملف
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);

            // التحقق من تنسيق الملف
            if (!this.validateImportData(data)) {
                throw new Error('تنسيق الملف غير صحيح');
            }

            // إنشاء نسخة احتياطية قبل الاستيراد
            this.createBackup(`قبل الاستيراد (وضع: ${this.importMode})`);

            // استيراد البيانات
            const result = await this.importData(data, this.importMode);
            
            if (result.success) {
                // حفظ في Firebase إذا كان المستخدم لديه صلاحية
                if (appState && appState.currentUser && checkPermission('canBackup')) {
                    const saved = await saveQuestionsToFirebase();
                    if (saved) {
                        showToast('✅ تم حفظ البيانات على السحابة', 'success');
                    }
                }

                // رسالة النجاح مع التفاصيل
                let successMessage = '✅ تم استيراد البيانات بنجاح';
                if (this.importMode === 'merge') {
                    successMessage += ` - تمت إضافة ${result.added} أسئلة جديدة`;
                    if (result.duplicates > 0) {
                        successMessage += `، تم تجاهل ${result.duplicates} أسئلة مكررة`;
                    }
                }
                showToast(successMessage, 'success');

                // تحديث الواجهة
                if (appState && appState.contentManagementMode && appState.currentContentUnit) {
                    renderContentManagement(appState.currentContentUnit);
                }

                // تحديث صفحة الوحدات الرئيسية
                if (typeof renderUnits === 'function') {
                    renderUnits();
                }

                // إظهار تقرير مفصل
                this.showImportReport(result);

                this.resetImport();
            }
            
        } catch (error) {
            console.error('❌ خطأ في الاستيراد:', error);
            showToast(`❌ فشل الاستيراد: ${error.message}`, 'error');
        } finally {
            // استعادة حالة الزر
            importBtn.disabled = false;
            importBtn.innerHTML = originalHTML;
        }
    }

    async importData(data, mode = 'merge') {
        try {
            console.log(`📥 بدء استيراد البيانات (الوضع: ${mode})...`);
            
            const importResult = {
                success: true,
                added: 0,
                duplicates: 0,
                totalImported: 0,
                mode: mode
            };

            // حفظ نسخة من البيانات القديمة للدمج
            const oldTrueFalse = [...trueFalseQuestionsData];
            const oldMCQ = [...mcqQuestionsData];
            const oldMultiSelect = [...multiSelectQuestionsData];
            const oldQA = [...qaQuestionsData];

            // إذا كان الوضع استبدال، نمسح البيانات الحالية أولاً
            if (mode === 'replace') {
                trueFalseQuestionsData = [];
                mcqQuestionsData = [];
                multiSelectQuestionsData = [];
                qaQuestionsData = [];
            }

            // استيراد البيانات من الملف
            if (data.units && Array.isArray(data.units)) {
                data.units.forEach(unit => {
                    const questions = unit.questions || [];
                    
                    questions.forEach(q => {
                        if (!q) return;
                        
                        // التحقق من التكرار (للدمج فقط)
                        if (mode === 'merge') {
                            const isDuplicate = this.isQuestionDuplicate(unit.type, q);
                            if (isDuplicate) {
                                importResult.duplicates++;
                                return;
                            }
                        }
                        
                        // إضافة السؤال
                        this.addQuestionToUnit(unit.type, q);
                        importResult.added++;
                    });
                });
            }
            
            // تحديث بيانات الوحدات
            updateUnitsDataFromFirebase();
            
            importResult.totalImported = this.calculateTotalQuestions();
            
            console.log('✅ تم استيراد البيانات بنجاح', importResult);
            return importResult;
            
        } catch (error) {
            console.error('❌ خطأ في الاستيراد:', error);
            throw error;
        }
    }

    isQuestionDuplicate(unitType, question) {
        switch(unitType) {
            case 'mcq-single-tf':
                return trueFalseQuestionsData.some(q => 
                    q.question?.trim() === question.question?.trim()
                );
                
            case 'mcq-single':
                return mcqQuestionsData.some(q => 
                    q.question?.trim() === question.question?.trim()
                );
                
            case 'mcq-multi':
                return multiSelectQuestionsData.some(q => 
                    q.question?.trim() === question.question?.trim()
                );
                
            case 'qa-display':
                if (question.type === 'header' || question.type === 'note') {
                    return qaQuestionsData.some(q => 
                        q.type === question.type && q.text?.trim() === question.text?.trim()
                    );
                } else {
                    return qaQuestionsData.some(q => 
                        q.type === question.type && q.question?.trim() === question.question?.trim()
                    );
                }
                
            default:
                return false;
        }
    }

    addQuestionToUnit(unitType, questionData) {
        switch(unitType) {
            case 'mcq-single-tf':
                trueFalseQuestionsData.push({
                    question: questionData.question || '',
                    options: questionData.options || ["صح", "خطأ"],
                    answerIndex: parseInt(questionData.answerIndex) || 0,
                    explanation: questionData.explanation || '',
                    page: questionData.page || ''
                });
                break;
                
            case 'mcq-single':
                mcqQuestionsData.push({
                    question: questionData.question || '',
                    options: questionData.options || [],
                    answerIndex: parseInt(questionData.answerIndex) || 0,
                    explanation: questionData.explanation || '',
                    page: questionData.page || ''
                });
                break;
                
            case 'mcq-multi':
                multiSelectQuestionsData.push({
                    question: questionData.question || '',
                    options: questionData.options || [],
                    answers: Array.isArray(questionData.answers) ? 
                        questionData.answers.map(a => parseInt(a)).filter(a => !isNaN(a)) : [],
                    explanation: questionData.explanation || '',
                    page: questionData.page || ''
                });
                break;
                
            case 'qa-display':
                if (questionData.type === 'header' || questionData.type === 'note') {
                    qaQuestionsData.push({
                        type: questionData.type,
                        text: questionData.text || questionData.question || ''
                    });
                } else {
                    qaQuestionsData.push({
                        type: questionData.type || 'qa',
                        question: questionData.question || '',
                        answer: questionData.answer || '',
                        explanation: questionData.explanation || '',
                        page: questionData.page || '',
                        section: questionData.section || ''
                    });
                }
                break;
        }
    }

    validateImportData(data) {
        if (!data) {
            showToast('❌ الملف فارغ أو غير صالح', 'error');
            return false;
        }
        
        if (!data.units || !Array.isArray(data.units)) {
            showToast('❌ تنسيق الملف غير صحيح: لا توجد وحدات', 'error');
            return false;
        }
        
        for (const unit of data.units) {
            if (!unit.id || !unit.title || !unit.type) {
                showToast('❌ تنسيق الملف غير صحيح: معلومات وحدة ناقصة', 'error');
                return false;
            }
            
            if (!unit.questions || !Array.isArray(unit.questions)) {
                showToast('❌ تنسيق الملف غير صحيح: لا توجد أسئلة في الوحدة', 'error');
                return false;
            }
        }
        
        return true;
    }

    // ==========================================
    // إظهار تقرير الاستيراد
    // ==========================================
    
    showImportReport(result) {
        const importStatus = document.getElementById('importStatus');
        if (!importStatus) return;
        
        let reportHTML = '';
        
        if (result.mode === 'merge') {
            reportHTML = `
                <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                            <i class="fas fa-check-circle text-green-600"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-green-800 dark:text-green-300">تم دمج البيانات بنجاح</h4>
                            <p class="text-sm text-green-600 dark:text-green-400">وضع الاستيراد: دمج البيانات</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="bg-white dark:bg-gray-800 p-3 rounded-lg">
                            <div class="text-lg font-bold text-green-600">${result.added}</div>
                            <div class="text-gray-600 dark:text-gray-400">أسئلة مضافة</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 p-3 rounded-lg">
                            <div class="text-lg font-bold text-yellow-600">${result.duplicates}</div>
                            <div class="text-gray-600 dark:text-gray-400">أسئلة مكررة (تم تجاهلها)</div>
                        </div>
                    </div>
                    
                    <div class="mt-3 pt-3 border-t border-green-200 dark:border-green-800 text-sm">
                        <div class="text-green-700 dark:text-green-300 font-medium">
                            <i class="fas fa-info-circle ml-1"></i>
                            إجمالي الأسئلة الآن: ${result.totalImported}
                        </div>
                    </div>
                </div>
            `;
        } else {
            reportHTML = `
                <div class="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                            <i class="fas fa-exchange-alt text-blue-600"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-blue-800 dark:text-blue-300">تم استبدال البيانات بنجاح</h4>
                            <p class="text-sm text-blue-600 dark:text-blue-400">وضع الاستيراد: استبدال البيانات</p>
                        </div>
                    </div>
                    
                    <div class="text-center py-2">
                        <div class="text-2xl font-bold text-blue-600">${result.added}</div>
                        <div class="text-gray-600 dark:text-gray-400">أسئلة جديدة</div>
                    </div>
                    
                    <div class="mt-3 text-sm text-blue-700 dark:text-blue-300">
                        <i class="fas fa-exclamation-triangle ml-1"></i>
                        تم حذف جميع الأسئلة القديمة واستبدالها بالجديدة
                    </div>
                </div>
            `;
        }
        
        importStatus.innerHTML = reportHTML;
        importStatus.classList.remove('hidden');
        
        // إخفاء التقرير بعد 10 ثوانٍ
        setTimeout(() => {
            importStatus.classList.add('hidden');
        }, 10000);
    }

    // ==========================================
    // النسخ الاحتياطي
    // ==========================================
    
    createBackup(description = 'نسخة احتياطية') {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                appName: this.appName,
                description: description,
                data: {
                    trueFalse: JSON.parse(JSON.stringify(trueFalseQuestionsData)),
                    mcq: JSON.parse(JSON.stringify(mcqQuestionsData)),
                    multiSelect: JSON.parse(JSON.stringify(multiSelectQuestionsData)),
                    qa: JSON.parse(JSON.stringify(qaQuestionsData))
                },
                metadata: {
                    totalQuestions: this.calculateTotalQuestions(),
                    exportDate: new Date().toLocaleString('ar-SA')
                }
            };
            
            const backupKey = `${this.backupKeyPrefix}${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            
            // حفظ آخر 5 نسخ فقط
            this.cleanOldBackups();
            
            showToast('✅ تم إنشاء نسخة احتياطية محلية', 'success');
            this.checkForBackups();
            
            return backupKey;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
            showToast('❌ فشل إنشاء النسخة الاحتياطية', 'error');
            return null;
        }
    }

    restoreLatestBackup() {
        const backupKeys = this.getBackupKeys();
        if (backupKeys.length === 0) {
            showToast('ℹ️ لا توجد نسخ احتياطية للاستعادة', 'info');
            return;
        }
        
        const latestKey = backupKeys.sort().reverse()[0];
        this.restoreBackup(latestKey);
    }

    async restoreBackup(backupKey) {
        if (!confirm('⚠️ سيتم استعادة هذه النسخة واستبدال البيانات الحالية. هل تريد المتابعة؟')) {
            return;
        }
        
        try {
            const backupData = JSON.parse(localStorage.getItem(backupKey));
            if (!backupData) {
                throw new Error('النسخة الاحتياطية غير موجودة');
            }
            
            trueFalseQuestionsData = backupData.data?.trueFalse || [];
            mcqQuestionsData = backupData.data?.mcq || [];
            multiSelectQuestionsData = backupData.data?.multiSelect || [];
            qaQuestionsData = backupData.data?.qa || [];
            
            updateUnitsDataFromFirebase();
            
            if (appState && appState.currentUser && checkPermission('canBackup')) {
                const success = await saveQuestionsToFirebase();
                if (success) {
                    showToast('✅ تم حفظ البيانات المستعادة على السحابة', 'success');
                }
            }
            
            showToast('✅ تم استعادة النسخة الاحتياطية بنجاح', 'success');
            
            if (appState && appState.contentManagementMode && appState.currentContentUnit) {
                renderContentManagement(appState.currentContentUnit);
            }
            
            if (typeof renderUnits === 'function') {
                renderUnits();
            }
            
            this.checkForBackups();
            
        } catch (error) {
            console.error('❌ خطأ في الاستعادة:', error);
            showToast('❌ فشل استعادة النسخة الاحتياطية', 'error');
        }
    }

    // ==========================================
    // الوظائف المساعدة
    // ==========================================
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('فشل قراءة الملف'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    downloadFile(content, filename, type) {
        try {
            const blob = new Blob([content], { type: type });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('❌ خطأ في تنزيل الملف:', error);
            throw error;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 بايت';
        const k = 1024;
        const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    calculateTotalQuestions() {
        return (trueFalseQuestionsData?.length || 0) + 
               (mcqQuestionsData?.length || 0) + 
               (multiSelectQuestionsData?.length || 0) + 
               (qaQuestionsData?.length || 0);
    }

    getAppName() {
        try {
            const title = document.title || 'اختبار تفاعلي';
            return title
                .replace(/[^\w\u0600-\u06FF\s]/g, '')
                .replace(/\s+/g, '_')
                .trim();
        } catch {
            return 'اختبار_التفاعلي';
        }
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    updateImportButtonState() {
        const fileInput = document.getElementById('jsonFileInput');
        const confirmBox = document.getElementById('confirmImport');
        const importBtn = document.getElementById('importBtn');
        
        if (!importBtn) return;
        
        const hasFile = fileInput && fileInput.files.length > 0;
        const isConfirmed = confirmBox ? confirmBox.checked : false;
        
        importBtn.disabled = !(hasFile && isConfirmed);
    }

    resetImport() {
        const elements = {
            fileInput: document.getElementById('jsonFileInput'),
            fileName: document.getElementById('selectedFileName'),
            dropZone: document.getElementById('fileDropZone'),
            confirmBox: document.getElementById('confirmImport'),
            importBtn: document.getElementById('importBtn'),
            importStatus: document.getElementById('importStatus')
        };
        
        if (elements.fileInput) elements.fileInput.value = '';
        if (elements.fileName) {
            elements.fileName.textContent = '';
            elements.fileName.className = '';
        }
        if (elements.dropZone) {
            elements.dropZone.classList.remove('border-green-400', 'dragover');
        }
        if (elements.confirmBox) elements.confirmBox.checked = false;
        if (elements.importBtn) {
            elements.importBtn.disabled = true;
            elements.importBtn.innerHTML = '<i class="fas fa-upload"></i> استيراد';
        }
        if (elements.importStatus) {
            elements.importStatus.classList.add('hidden');
            elements.importStatus.innerHTML = '';
        }
    }

    showImportError(message) {
        const importStatus = document.getElementById('importStatus');
        if (importStatus) {
            importStatus.innerHTML = `
                <div class="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-exclamation-circle"></i>
                        <span class="font-bold">${message}</span>
                    </div>
                </div>
            `;
            importStatus.classList.remove('hidden');
            
            setTimeout(() => {
                importStatus.classList.add('hidden');
            }, 5000);
        }
    }

    checkForBackups() {
        try {
            const backupKeys = this.getBackupKeys();
            const restoreBtn = document.getElementById('restoreBtn');
            const backupList = document.getElementById('backupList');
            
            if (!restoreBtn || !backupList) return;
            
            if (backupKeys.length > 0) {
                restoreBtn.classList.remove('hidden');
                backupList.classList.remove('hidden');
                
                this.displayBackupList(backupKeys);
            } else {
                restoreBtn.classList.add('hidden');
                backupList.classList.add('hidden');
            }
        } catch (error) {
            console.error('❌ خطأ في التحقق من النسخ:', error);
        }
    }

    displayBackupList(backupKeys) {
        const backupList = document.getElementById('backupList');
        if (!backupList) return;
        
        backupList.innerHTML = `
            <div class="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm">
                📦 النسخ الاحتياطية المتاحة (${backupKeys.length})
            </div>
        `;
        
        backupKeys.sort().reverse().forEach(key => {
            try {
                const backupData = JSON.parse(localStorage.getItem(key));
                if (backupData) {
                    const date = new Date(backupData.timestamp).toLocaleString('ar-SA');
                    const questionCount = this.calculateTotalQuestions(backupData);
                    
                    backupList.innerHTML += `
                        <div class="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <div class="font-bold text-gray-900 dark:text-white text-sm mb-1">
                                        ${backupData.description || 'نسخة احتياطية'}
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        ${date}
                                    </div>
                                    <div class="text-xs text-blue-600 dark:text-blue-400">
                                        ${questionCount} سؤال
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="exportManager.restoreBackup('${key}')" 
                                            class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors">
                                        استعادة
                                    </button>
                                    <button onclick="exportManager.deleteBackup('${key}')" 
                                            class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors">
                                        حذف
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                console.error('❌ خطأ في عرض النسخة:', e);
            }
        });
    }

    deleteBackup(key) {
        if (confirm('هل تريد حذف هذه النسخة الاحتياطية؟')) {
            localStorage.removeItem(key);
            this.checkForBackups();
            showToast('✅ تم حذف النسخة الاحتياطية', 'success');
        }
    }

    cleanOldBackups() {
        try {
            const backupKeys = this.getBackupKeys();
            if (backupKeys.length > this.maxBackups) {
                backupKeys.sort().slice(0, backupKeys.length - this.maxBackups).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (error) {
            console.error('❌ خطأ في تنظيف النسخ القديمة:', error);
        }
    }

    getBackupKeys() {
        try {
            return Object.keys(localStorage)
                .filter(key => key.startsWith(this.backupKeyPrefix))
                .sort();
        } catch (error) {
            console.error('❌ خطأ في قراءة مفاتيح النسخ:', error);
            return [];
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.json')) {
            this.showImportError('يجب أن يكون الملف بتنسيق JSON');
            e.target.value = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showImportError('حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)');
            e.target.value = '';
            return;
        }

        const fileName = document.getElementById('selectedFileName');
        if (fileName) {
            fileName.textContent = `📄 ${file.name} (${this.formatFileSize(file.size)})`;
            fileName.className = 'text-green-600 dark:text-green-400 font-medium text-sm mt-2';
        }

        const dropZone = document.getElementById('fileDropZone');
        if (dropZone) dropZone.classList.add('border-green-400');

        this.updateImportButtonState();
    }

    handleFileDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        const fileInput = document.getElementById('jsonFileInput');
        
        if (files.length > 0) {
            fileInput.files = files;
            this.handleFileSelect({ target: fileInput });
        }
    }

    redefineExportButtons() {
        console.log('🔄 إعادة تعريف أزرار التصدير والاستيراد');
        
        window.exportToJSON = () => this.exportToJSON();
        window.exportToExcel = () => this.exportToExcel();
        window.importFromJSON = () => this.importFromJSON();
        
        console.log('✅ تم إعادة تعريف أزرار التصدير والاستيراد');
    }
}

// ==========================================
// تهيئة النظام وتصديره للاستخدام العام
// ==========================================

function initExportImport() {
    console.log('🚀 تهيئة نظام التصدير والاستيراد...');
    exportManager = new ExportImportManager();
    exportManager.init();
    
    window.exportManager = exportManager;
    
    window.exportToJSON = () => exportManager.exportToJSON();
    window.exportToExcel = () => exportManager.exportToExcel();
    window.importFromJSON = () => exportManager.importFromJSON();
    window.resetImport = () => exportManager.resetImport();
    window.createBackup = () => exportManager.createBackup();
    window.restoreFromBackup = () => exportManager.restoreLatestBackup();
    window.restoreBackup = (key) => exportManager.restoreBackup(key);
    
    console.log('✅ نظام التصدير والاستيراد جاهز للاستخدام');
    return exportManager;
}

// ==========================================
// ربط الدوال بالنافذة العامة
// ==========================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportImportManager, initExportImport };
} else {
    window.ExportImportManager = ExportImportManager;
    window.initExportImport = initExportImport;
}
