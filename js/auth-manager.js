// ==========================================
// نظام إدارة المستخدمين والمصادقة
// ==========================================

// الثوابت العامة


// تعريف ROLES في النطاق العام
const ROLES = {
    'super_admin': { 
        label: 'مدير رئيسي', 
        icon: 'fa-crown',
        iconColor: 'from-yellow-500 to-amber-600',
        canEdit: true, 
        canDelete: true, 
        canCreate: true, 
        canUsers: true, 
        canSettings: true, 
        canBackup: true, 
        canNavigation: true, 
        canAccessAdmin: true, 
        canSeePassword: true, 
        canViewActivityLog: true, 
        canDeleteActivityLog: true 
    },
    'admin': { 
        label: 'مدير نظام', 
        icon: 'fa-user-shield',
        iconColor: 'from-blue-500 to-indigo-600',
        canEdit: true, 
        canDelete: true, 
        canCreate: true, 
        canUsers: false, 
        canSettings: false, 
        canBackup: false, 
        canNavigation: false, 
        canAccessAdmin: true, 
        canSeePassword: false, 
        canViewActivityLog: false, 
        canDeleteActivityLog: false 
    },
    'editor': { 
        label: 'محرر محتوى', 
        icon: 'fa-pen-nib',
        iconColor: 'from-green-500 to-emerald-600',
        canEdit: true, 
        canDelete: false, 
        canCreate: true, 
        canUsers: false, 
        canSettings: false, 
        canBackup: false, 
        canNavigation: false, 
        canAccessAdmin: true, 
        canSeePassword: false, 
        canViewActivityLog: false, 
        canDeleteActivityLog: false 
    },
    'student': { 
        label: 'طالب', 
        icon: 'fa-user-graduate',
        iconColor: 'from-purple-500 to-violet-600',
        canEdit: false, 
        canDelete: false, 
        canCreate: false, 
        canUsers: false, 
        canSettings: false, 
        canBackup: false, 
        canNavigation: false, 
        canAccessAdmin: false, 
        canSeePassword: false, 
        canViewActivityLog: false, 
        canDeleteActivityLog: false 
    }
};

// حالة إدارة المستخدمين
let userManagementState = {
    usersList: [],
    filteredUsers: [],
    roleFilter: 'all',
    statusFilter: 'all',
    isLoading: false
};

// ==========================================
// دوال المساعدة الأساسية
// ==========================================

function getRoleName(role) {
    return ROLES[role]?.label || role;
}

function getRoleIcon(role) {
    return ROLES[role]?.icon || 'fa-user';
}

function getRoleIconColor(role) {
    return ROLES[role]?.iconColor || 'from-gray-500 to-gray-700';
}

function getRoleIconHTML(role, size = 'text-base') {
    const icon = getRoleIcon(role);
    const color = getRoleIconColor(role);
    return `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white ${size.includes('text-') ? size : 'text-base'}">
            <i class="fas ${icon}"></i>
        </div>
    `;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function checkPermission(permission) {
    if (!appState.currentUser) return false;
    const userRole = ROLES[appState.currentUser.role];
    return userRole ? userRole[permission] : false;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found': return 'البريد الإلكتروني غير مسجل';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة';
        case 'auth/invalid-email': return 'بريد إلكتروني غير صالح';
        case 'auth/too-many-requests': return 'تم محاولة الدخول عدة مرات، حاول لاحقاً';
        case 'auth/email-already-in-use': return 'البريد الإلكتروني مستخدم بالفعل';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل';
        case 'auth/invalid-login-credentials': return 'بيانات الدخول غير صحيحة';
        default: return error.message || 'حدث خطأ غير متوقع';
    }
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
}

// ==========================================
// دوال قاعدة البيانات (Firebase)
// ==========================================

async function getUserByEmail(email) {
    try {
        const snapshot = await database
            .ref(USERS_PATH)
            .orderByChild('email')
            .equalTo(email)
            .once('value');
        
        if (!snapshot.exists()) return null;
        
        let userData = null;
        snapshot.forEach(child => {
            userData = { id: child.key, ...child.val() };
        });
        
        return userData;
    } catch (error) {
        console.error('خطأ في الحصول على المستخدم:', error);
        return null;
    }
}

async function checkIfFirstUser() {
    try {
        const snapshot = await database.ref(USERS_PATH).once('value');
        return !snapshot.exists() || snapshot.numChildren() === 0;
    } catch (error) {
        console.error('خطأ في التحقق من وجود مستخدمين:', error);
        return false;
    }
}

// ==========================================
// دوال المصادقة
// ==========================================

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('submitLogin');
    
    if (!email || !password) {
        showToast('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري التحقق...';
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userData = await getUserByEmail(email);
        
        if (!userData) {
            throw new Error('المستخدم غير موجود في قاعدة البيانات');
        }
        
        if (userData.isActive === false) {
            await auth.signOut();
            throw new Error('حسابك معطل. الرجاء التواصل مع المسؤول');
        }
        
        appState.currentUser = userData;
        appState.firebaseUser = userCredential.user;
        
        await database.ref(`${USERS_PATH}/${userData.id}`).update({
            lastLogin: Date.now()
        });
        
        refreshUIForUserPermissions();
        hideLoginModal();
        showToast('تم تسجيل الدخول بنجاح', 'success');
        
        // تحميل البيانات من Firebase
        if (typeof loadDataFromFirebase === 'function') {
            loadDataFromFirebase();
        }
        
        if (typeof loadQuestionsFromFirebase === 'function') {
            loadQuestionsFromFirebase();
        }
        
    } catch (error) {
        showToast(getErrorMessage(error), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'تسجيل الدخول';
    }
}

async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const submitBtn = document.getElementById('submitSignup');
    
    if (!name || !email || !password || !confirmPassword) {
        showToast('جميع الحقول مطلوبة', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('كلمات المرور غير متطابقة', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الإنشاء...';
    
    try {
        const emailCheck = await getUserByEmail(email);
        if (emailCheck) {
            throw new Error('البريد الإلكتروني مستخدم بالفعل');
        }
        
        const isFirstUser = await checkIfFirstUser();
        const userRole = isFirstUser ? 'super_admin' : 'student';
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const newUserRef = database.ref(USERS_PATH).push();
        const userData = {
            name: name,
            email: email,
            role: userRole,
            isActive: true,
            createdAt: Date.now(),
            lastLogin: Date.now()
        };
        
        await newUserRef.set(userData);
        
        appState.currentUser = { id: newUserRef.key, ...userData };
        appState.firebaseUser = userCredential.user;
        
        refreshUIForUserPermissions();
        hideLoginModal();
        showToast(isFirstUser ? 
            'تم إنشاء حساب المدير الرئيسي بنجاح!' : 
            'تم إنشاء حساب الطالب بنجاح!', 'success');
        
        if (userRole === 'super_admin') {
            loadUsersForPage();
        }
        
    } catch (error) {
        showToast(getErrorMessage(error), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'إنشاء حساب';
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        appState.currentUser = null;
        appState.firebaseUser = null;
        refreshUIForUserPermissions();
        showToast('تم تسجيل الخروج بنجاح', 'info');
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
        showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
    }
}

// ==========================================
// دوال واجهة المستخدم
// ==========================================

function updateUserUI() {
    const headerUserInfo = document.getElementById('headerUserInfo');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerUserName = document.getElementById('headerUserName');
    const headerUserEmail = document.getElementById('headerUserEmail');
    const headerAvatarIcon = document.getElementById('headerAvatarIcon');
    const headerUserIcon = document.getElementById('headerUserIcon');
    const headerAdminDropdown = document.getElementById('headerAdminDropdown');
    
    if (appState.currentUser) {
        headerUserInfo.classList.remove('hidden');
        headerLoginBtn.classList.add('hidden');
        
        if (headerUserName) headerUserName.textContent = appState.currentUser.name || 'مستخدم';
        if (headerUserEmail) headerUserEmail.textContent = appState.currentUser.email || '';
        
        // تحديث الأيقونة حسب الصلاحية
        if (headerAvatarIcon) {
            headerAvatarIcon.innerHTML = getRoleIconHTML(appState.currentUser.role, 'text-sm');
        }
        
        if (headerUserIcon) {
            headerUserIcon.innerHTML = getRoleIconHTML(appState.currentUser.role, 'text-base');
        }
        
        if (headerAdminDropdown) {
            headerAdminDropdown.classList.toggle('hidden', !checkPermission('canUsers'));
        }
        
        // إضافة تأثير مرئي لتأكيد تسجيل الدخول
        setTimeout(() => {
            const userAvatar = document.getElementById('headerUserAvatar');
            if (userAvatar) {
                userAvatar.style.transform = 'scale(1.1)';
                userAvatar.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';
                setTimeout(() => {
                    userAvatar.style.transform = 'scale(1)';
                    userAvatar.style.boxShadow = 'none';
                }, 300);
            }
        }, 100);
        
    } else {
        headerUserInfo.classList.add('hidden');
        headerLoginBtn.classList.remove('hidden');
        
        // إعادة تعيين الصفحة إذا كان المستخدم في صفحة إدارة
        if (appState.contentManagementMode || appState.currentView === 'users') {
            showUnitsView();
        }
    }
}

function refreshUIForUserPermissions() {
    updateUserUI();
    
    // تحديث زر إضافة سؤال جديد
    const addNewQuestionBtn = document.getElementById('addNewQuestionBtn');
    if (addNewQuestionBtn) {
        addNewQuestionBtn.classList.toggle('hidden', !checkPermission('canCreate'));
    }
    
    // تحديث أزرار إدارة المحتوى في صفحة الوحدات
    document.querySelectorAll('.admin-btn').forEach(btn => {
        const unitId = parseInt(btn.dataset.unitId);
        if (unitId) {
            btn.style.display = checkPermission('canAccessAdmin') ? 'block' : 'none';
        }
    });
    
    // تحديث حالة المزامنة
    const syncAllBtn = document.getElementById('syncAllBtn');
    if (syncAllBtn) {
        syncAllBtn.classList.toggle('hidden', !appState.currentUser);
    }
    
    // إذا كنا في صفحة إدارة المحتوى، نعيد عرضها
    if (appState.contentManagementMode && appState.currentContentUnit) {
        if (typeof renderContentManagement === 'function') {
            renderContentManagement(appState.currentContentUnit);
        }
    }
    
    // إذا كنا في صفحة إدارة المستخدمين، نعيد عرضها
    if (appState.currentView === 'users') {
        loadUsersForPage();
    }
    
    // إذا كنا في صفحة سجل النشاط، نعيد عرضها
    if (appState.currentView === 'activityLog') {
        if (typeof loadActivityLog === 'function') {
            loadActivityLog();
        }
    }
    
    // تحديث صفحة الوحدات
    if (document.getElementById('unitsView') && 
        !document.getElementById('unitsView').classList.contains('hidden')) {
        if (typeof renderUnits === 'function') {
            renderUnits();
        }
    }
}

function initDropdowns() {
    document.getElementById('headerUserAvatar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('headerUserDropdown');
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        document.getElementById('headerUserDropdown')?.classList.remove('show');
        document.getElementById('dropdownMenu')?.classList.add('hidden');
    });
}

// ==========================================
// دوال إدارة المستخدمين
// ==========================================

function loadUsersForPage() {
    userManagementState.isLoading = true;
    updateLoadingState(true);
    
    try {
        database.ref(USERS_PATH).once('value').then(snapshot => {
            userManagementState.usersList = [];
            
            snapshot.forEach(child => {
                userManagementState.usersList.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            userManagementState.usersList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            updateUserStats();
            filterUsers();
            
        }).catch(error => {
            console.error('خطأ في تحميل المستخدمين:', error);
            showToast('حدث خطأ في تحميل قائمة المستخدمين', 'error');
            document.getElementById('usersTableBody').innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-triangle ml-2"></i>
                        حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.
                    </td>
                </tr>
            `;
        }).finally(() => {
            userManagementState.isLoading = false;
            updateLoadingState(false);
        });
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
        userManagementState.isLoading = false;
        updateLoadingState(false);
    }
}

function updateLoadingState(isLoading) {
    const loadingEl = document.getElementById('loadingUsers');
    const tableBody = document.getElementById('usersTableBody');
    const noUsersEl = document.getElementById('noUsersMessage');
    
    if (isLoading) {
        loadingEl.classList.remove('hidden');
        tableBody.classList.add('hidden');
        noUsersEl.classList.add('hidden');
    } else {
        loadingEl.classList.add('hidden');
        tableBody.classList.remove('hidden');
    }
}

function updateUserStats() {
    const users = userManagementState.usersList;
    
    const total = users.length;
    const active = users.filter(u => u.isActive !== false).length;
    
    // تصنيف حسب الصلاحيات
    const superAdmins = users.filter(u => u.role === 'super_admin').length;
    const admins = users.filter(u => u.role === 'admin').length;
    const editors = users.filter(u => u.role === 'editor').length;
    const students = users.filter(u => u.role === 'student').length;
    
    document.getElementById('totalUsersCount').textContent = total;
    document.getElementById('activeUsersCount').textContent = active;
    
    const adminUsersCountEl = document.getElementById('adminUsersCount');
    if (adminUsersCountEl) {
        adminUsersCountEl.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <span>${superAdmins + admins + editors}</span>
                <div class="flex gap-1">
                    ${superAdmins > 0 ? getRoleIconHTML('super_admin', 'text-xs') : ''}
                    ${admins > 0 ? getRoleIconHTML('admin', 'text-xs') : ''}
                    ${editors > 0 ? getRoleIconHTML('editor', 'text-xs') : ''}
                </div>
            </div>
        `;
    }
    
    const studentUsersCountEl = document.getElementById('studentUsersCount');
    if (studentUsersCountEl) {
        studentUsersCountEl.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <span>${students}</span>
                ${getRoleIconHTML('student', 'text-xs')}
            </div>
        `;
    }
}

function filterUsers() {
    let filtered = [...userManagementState.usersList];
    
    // التصفية حسب البحث الموحد
    if (typeof SearchManager !== 'undefined' && SearchManager.state.currentSearchQuery) {
        const query = SearchManager.state.currentSearchQuery.toLowerCase();
        filtered = filtered.filter(user => 
            (user.name && user.name.toLowerCase().includes(query)) ||
            (user.email && user.email.toLowerCase().includes(query))
        );
    }
    
    // التصفية حسب الصلاحية
    if (userManagementState.roleFilter !== 'all') {
        filtered = filtered.filter(user => user.role === userManagementState.roleFilter);
    }
    
    // التصفية حسب الحالة
    if (userManagementState.statusFilter !== 'all') {
        const isActive = userManagementState.statusFilter === 'active';
        filtered = filtered.filter(user => 
            (isActive && user.isActive !== false) || 
            (!isActive && user.isActive === false)
        );
    }
    
    userManagementState.filteredUsers = filtered;
    renderUsersTable();
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const noUsersEl = document.getElementById('noUsersMessage');
    
    if (!tbody) return;
    
    if (userManagementState.filteredUsers.length === 0) {
        tbody.innerHTML = '';
        noUsersEl.classList.remove('hidden');
        return;
    }
    
    noUsersEl.classList.add('hidden');
    
    tbody.innerHTML = userManagementState.filteredUsers.map(user => {
        const isCurrentUser = appState.currentUser && user.id === appState.currentUser.id;
        
        let lastLoginText = 'لم يسجل دخول بعد';
        if (user.lastLogin) {
            const lastLogin = new Date(user.lastLogin);
            const now = new Date();
            const diffDays = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                lastLoginText = 'اليوم ' + lastLogin.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            } else if (diffDays === 1) {
                lastLoginText = 'أمس ' + lastLogin.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            } else if (diffDays < 7) {
                lastLoginText = `منذ ${diffDays} أيام`;
            } else {
                lastLoginText = lastLogin.toLocaleDateString('ar-SA');
            }
        }
        
        return `
            <tr>
                <td>
                    <div class="flex items-center gap-3">
                        ${getRoleIconHTML(user.role, 'text-sm')}
                        <div>
                            <div class="font-bold text-gray-900 dark:text-white">${user.name || 'بدون اسم'}</div>
                            <div class="text-xs text-gray-500">
                                <i class="fas ${getRoleIcon(user.role)} ml-1"></i>
                                ${getRoleName(user.role)}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="text-gray-700 dark:text-gray-300">${user.email}</td>
                <td>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive === false ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}">
                        <i class="fas ${user.isActive === false ? 'fa-ban' : 'fa-check-circle'} ml-1"></i>
                        ${user.isActive === false ? 'معطل' : 'نشط'}
                    </span>
                </td>
                <td class="text-sm text-gray-600 dark:text-gray-400">${lastLoginText}</td>
                <td>
                    <div class="user-actions">
                        ${!isCurrentUser ? `
                            <button onclick="editUser('${user.id}')" 
                                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs"
                                    title="تعديل المستخدم">
                                <i class="fas fa-edit"></i>
                                تعديل
                            </button>
                            <button onclick="toggleUserStatus('${user.id}', ${user.isActive !== false})" 
                                    class="${user.isActive === false ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-yellow-500 hover:bg-yellow-600'} text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs"
                                    title="${user.isActive === false ? 'تفعيل' : 'تعطيل'} الحساب">
                                <i class="fas ${user.isActive === false ? 'fa-check' : 'fa-ban'}"></i>
                                ${user.isActive === false ? 'تفعيل' : 'تعطيل'}
                            </button>
                            <button onclick="deleteUser('${user.id}')" 
                                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs"
                                    title="حذف المستخدم">
                                <i class="fas fa-trash"></i>
                                حذف
                            </button>
                        ` : `
                            <span class="text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5">
                                <i class="fas fa-user ml-1"></i>
                                حسابك
                            </span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupUserManagementEvents() {
    document.getElementById('roleFilter')?.addEventListener('change', (e) => {
        userManagementState.roleFilter = e.target.value;
        filterUsers();
    });
    
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        userManagementState.statusFilter = e.target.value;
        filterUsers();
    });
}

// ==========================================
// دوال إدارة المستخدمين (CRUD)
// ==========================================

function showAddUserModal() {
    if (!appState.currentUser || !ROLES[appState.currentUser.role]?.canUsers) {
        showToast('ليس لديك صلاحية لإضافة مستخدمين', 'error');
        return;
    }
    
    appState.editingUserId = null;
    document.getElementById('userModalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('editUserId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userConfirmPassword').value = '';
    
    // تحديد زر الراديو الافتراضي
    document.querySelectorAll('input[name="userRole"]').forEach(radio => {
        radio.checked = radio.value === 'student';
    });
    
    document.getElementById('userActive').checked = true;
    
    document.getElementById('passwordSection').classList.remove('hidden');
    document.getElementById('confirmPasswordSection').classList.remove('hidden');
    
    showUserEditModal();
}

function editUser(userId) {
    if (!appState.currentUser || !ROLES[appState.currentUser.role]?.canUsers) {
        showToast('ليس لديك صلاحية لتعديل المستخدمين', 'error');
        return;
    }
    
    const user = userManagementState.usersList.find(u => u.id === userId);
    if (!user) return;
    
    appState.editingUserId = userId;
    document.getElementById('userModalTitle').textContent = 'تعديل المستخدم';
    document.getElementById('editUserId').value = userId;
    document.getElementById('userName').value = user.name || '';
    document.getElementById('userEmail').value = user.email || '';
    
    // تحديد زر الراديو حسب صلاحية المستخدم
    document.querySelectorAll('input[name="userRole"]').forEach(radio => {
        radio.checked = radio.value === user.role;
    });
    
    document.getElementById('userActive').checked = user.isActive !== false;
    
    document.getElementById('passwordSection').classList.add('hidden');
    document.getElementById('confirmPasswordSection').classList.add('hidden');
    
    showUserEditModal();
}

function showUserEditModal() {
    document.getElementById('userEditModal').classList.add('active');
}

function hideUserEditModal() {
    document.getElementById('userEditModal').classList.remove('active');
    document.getElementById('userError').classList.add('hidden');
}

async function saveUser() {
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const confirmPassword = document.getElementById('userConfirmPassword').value;
    const role = document.querySelector('input[name="userRole"]:checked')?.value || 'student';
    const isActive = document.getElementById('userActive').checked;
    const isEdit = !!userId;
    
    const errorDiv = document.getElementById('userError');
    const saveBtn = document.getElementById('saveUserBtn');
    
    if (!name || !email) {
        showError(errorDiv, 'الاسم والبريد الإلكتروني مطلوبان');
        return;
    }
    
    if (!isEdit) {
        if (!password) {
            showError(errorDiv, 'كلمة المرور مطلوبة');
            return;
        }
        
        if (password.length < 6) {
            showError(errorDiv, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        
        if (password !== confirmPassword) {
            showError(errorDiv, 'كلمات المرور غير متطابقة');
            return;
        }
    }
    
    if (!validateEmail(email)) {
        showError(errorDiv, 'البريد الإلكتروني غير صالح');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';
    
    try {
        let userData = {
            name: name,
            email: email,
            role: role,
            isActive: isActive,
            updatedAt: Date.now()
        };
        
        if (!isEdit) {
            userData.createdAt = Date.now();
            userData.lastLogin = null;
            
            const emailCheck = await getUserByEmail(email);
            if (emailCheck) {
                throw new Error('البريد الإلكتروني مستخدم بالفعل');
            }
            
            const newUserRef = database.ref(USERS_PATH).push();
            await newUserRef.set(userData);
            
            // تسجيل النشاط
            if (typeof activityLogger !== 'undefined' && activityLogger.logActivity) {
                await activityLogger.logActivity('ADD', {
                    unitId: 'users',
                    unitTitle: 'إدارة المستخدمين',
                    questionIndex: 0,
                    questionText: `مستخدم: ${name} (${email})`,
                    newData: userData
                });
            }
            
            showToast('تم إضافة المستخدم بنجاح', 'success');
            
        } else {
            const oldUser = userManagementState.usersList.find(u => u.id === userId);
            
            if (oldUser.email !== email) {
                const emailCheck = await getUserByEmail(email);
                if (emailCheck && emailCheck.id !== userId) {
                    throw new Error('البريد الإلكتروني مستخدم بالفعل من قبل مستخدم آخر');
                }
            }
            
            // حفظ البيانات القديمة لتسجيل النشاط
            const oldData = {
                name: oldUser.name,
                email: oldUser.email,
                role: oldUser.role,
                isActive: oldUser.isActive
            };
            
            await database.ref(`${USERS_PATH}/${userId}`).update(userData);
            
            // تسجيل النشاط
            if (typeof activityLogger !== 'undefined' && activityLogger.logActivity) {
                await activityLogger.logActivity('EDIT', {
                    unitId: 'users',
                    unitTitle: 'إدارة المستخدمين',
                    questionIndex: 0,
                    questionText: `مستخدم: ${name} (${email})`,
                    oldData: oldData,
                    newData: userData
                });
            }
            
            showToast('تم تحديث بيانات المستخدم بنجاح', 'success');
        }
        
        await loadUsersForPage();
        hideUserEditModal();
        
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        showError(errorDiv, errorMessage);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'حفظ';
    }
}

async function toggleUserStatus(userId, isCurrentlyActive) {
    if (!appState.currentUser || !ROLES[appState.currentUser.role]?.canUsers) {
        showToast('ليس لديك صلاحية لتغيير حالة المستخدمين', 'error');
        return;
    }
    
    const user = userManagementState.usersList.find(u => u.id === userId);
    if (!user) return;
    
    if (confirm(`هل تريد ${isCurrentlyActive ? 'تعطيل' : 'تفعيل'} هذا الحساب؟`)) {
        try {
            const newStatus = !isCurrentlyActive;
            await database.ref(`${USERS_PATH}/${userId}`).update({ 
                isActive: newStatus,
                updatedAt: Date.now()
            });
            
            showToast(`تم ${newStatus ? 'تفعيل' : 'تعطيل'} الحساب بنجاح`, 'success');
            await loadUsersForPage();
            
        } catch (error) {
            console.error('خطأ في تغيير حالة المستخدم:', error);
            showToast('حدث خطأ في تغيير حالة المستخدم', 'error');
        }
    }
}

async function deleteUser(userId) {
    if (!appState.currentUser || !ROLES[appState.currentUser.role]?.canUsers) {
        showToast('ليس لديك صلاحية لحذف المستخدمين', 'error');
        return;
    }
    
    const user = userManagementState.usersList.find(u => u.id === userId);
    if (!user) return;
    
    if (user.id === appState.currentUser.id) {
        showToast('لا يمكنك حذف حسابك الخاص', 'error');
        return;
    }
    
    if (confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟ هذه العملية لا يمكن التراجع عنها.`)) {
        try {
            // حفظ نسخة من البيانات قبل الحذف
            const userData = {
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            };
            
            await database.ref(`${USERS_PATH}/${userId}`).remove();
            
            // تسجيل النشاط
            if (typeof activityLogger !== 'undefined' && activityLogger.logActivity) {
                await activityLogger.logActivity('DELETE', {
                    unitId: 'users',
                    unitTitle: 'إدارة المستخدمين',
                    questionIndex: 0,
                    questionText: `مستخدم: ${user.name} (${user.email})`,
                    oldData: userData
                });
            }
            
            showToast('تم حذف المستخدم بنجاح', 'success');
            await loadUsersForPage();
            
        } catch (error) {
            console.error('خطأ في حذف المستخدم:', error);
            showToast('حدث خطأ في حذف المستخدم', 'error');
        }
    }
}

// ==========================================
// تهيئة نظام المصادقة
// ==========================================

function initializeAuthSystem() {
    // الاستماع لتغير حالة المصادقة
    auth.onAuthStateChanged(async (user) => {
        appState.firebaseUser = user;
        
        if (user) {
            const userData = await getUserByEmail(user.email);
            if (userData) {
                if (userData.isActive === false) {
                    await auth.signOut();
                    appState.currentUser = null;
                    appState.firebaseUser = null;
                    showToast('حسابك معطل. الرجاء التواصل مع المسؤول', 'error');
                } else {
                    appState.currentUser = userData;
                }
            } else {
                appState.currentUser = null;
            }
        } else {
            appState.currentUser = null;
        }
        
        refreshUIForUserPermissions();
    });
    
    // ربط أحداث الأزرار
    document.getElementById('submitLogin')?.addEventListener('click', handleLogin);
    document.getElementById('submitSignup')?.addEventListener('click', handleSignup);
    document.getElementById('signupToggle')?.addEventListener('click', showSignupForm);
    document.getElementById('loginToggle')?.addEventListener('click', showLoginForm);
    document.getElementById('closeLoginModal')?.addEventListener('click', hideLoginModal);
    document.getElementById('headerLoginBtn')?.addEventListener('click', showLoginModal);
    
    // تهيئة القوائم المنسدلة
    initDropdowns();
}

// ==========================================
// تصدير الدوال للاستخدام في الملفات الأخرى
// ==========================================

// جعل الدوال متاحة للنطاق العام
window.ROLES = ROLES;
window.getRoleName = getRoleName;
window.getRoleIconHTML = getRoleIconHTML;
window.checkPermission = checkPermission;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.refreshUIForUserPermissions = refreshUIForUserPermissions;
window.showAddUserModal = showAddUserModal;
window.editUser = editUser;
window.saveUser = saveUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.showUserEditModal = showUserEditModal;
window.hideUserEditModal = hideUserEditModal;
window.loadUsersForPage = loadUsersForPage;
window.setupUserManagementEvents = setupUserManagementEvents;
window.initializeAuthSystem = initializeAuthSystem;