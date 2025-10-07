const { createApp, ref, computed, watch, onMounted } = Vue;

// Константы
const FOLDERS_STRUCTURE_FILE = 'folders_structure.json';
const RECIPIENTS_FILE = 'recipients.json';
const SENDER_PROFILE_FILE = 'sender_profile.json';

// Инициализация Dropbox
let dropbox;
let isDropboxInitialized = false;

// Константы для OAuth
const DROPBOX_CLIENT_ID = 's0m2ifpklek27v7';
const DROPBOX_CLIENT_SECRET = '0fgerjun66hpztg';
const TOKEN_STORAGE_KEY = 'dropbox_tokens';

// Ваши refresh token и access token (замените на полученные из curl)
const INITIAL_REFRESH_TOKEN = 'z3DDMYdOJacAAAAAAAAAAYJqZEQdAktNqNzgg2XaBZcnLZzzeY3ALB5ce2mmRrFc';
const INITIAL_ACCESS_TOKEN = 'sl.u.AF2Id1V3HpWyEgmtDLCsGJSEequEFCpCA0NVwsmnvcxkes3zm3mEB8OFpKvDAOQjp1EeKDGuwlphjkv9apQY5JG_m1xnXEKY4pZA4s_fXx5jlBPe-zAQ4nrFe-7_gRTAhHFXXGbGpWqHmdhEQaK3nw221k2XZDKt1SIE9OT_qflTlqo8yGblN7wlCdbMRjfe9DCjVIeMBjGeGxz9YgOcbKaJKKLxgH1mr8c1eafBGar_cVPM0DKDEMiscSgLeeu5C0_x5aXqBeYZ5EEFLGyAjjhYiOfCzCTYBxF5PlbVbfc4XPgaQd8yAW-CNcwkEL--w8OLA_0GJ3yOa3gobYUwvfGo3kGrXvJUguJ6Jk0IYh9MmmNhjR06p01lSAZoV8leXO04pqbLcGAuyzRFa5-g1x214k_rVnFXMNkHIEKGdYEWOkS7G_BLOoL7C8JqDhYZMPLB2HIdoGxNdwpaq9qo0kR1Zj3SH_MxwDwYSKAPu69RMKY6JzpvYTSUcU-z_naPUXSrf6L0t8qKhwU0gEmFAP3Fw3cfkdh4hct-jKf_P9w_gFaLITP0ALqb1EZZcCAdV-hqOhoNk44gXCCAekQM5_pksVn2CxYmyOGII3pFNMDzMrVPDP9tc6QPPWjlWVQFJ6jxJpxoVsYoU_1wG-bkY-GT8yyoqR4OuQFhcpSXExDSc0Rcbd9TMsh74zdiuhlIhRzD_nE4TTf4oBHIFq8B2VQ6pBjh6PK3onD5JIPMMeO0tF6UhgAp29pCYekWgpYT-KCCMEenHGKFPrr6e79o0K4s6ISGhxyXaJ3uQegjmFAozjuPwa2nTkZxsZAbcOeFf1kcpGiAGk8WX7Bt7hnEEmWFpeK0uXBYFRU2NT2qNlv9guUgUDx3-UxL1Hs_gJnT_0SonoOiM1S_AsTJL7KB1sjL1Z4WYioV1-Kc4KPFYbLj1YcsKlID0DW3STV_1__qey3hKd3StTaoo5Qx60Njz96RknRKb39Xa8e4Bhl0el6z814HciLwmGqt-xTR3DRY4VhuJe7iYHAIMndd3XI8I2t64mXcBg-xyaHEgyC2E2xnjhHj2D67a2bfmp3HUKTtkSfKtJPoXDQ1WDThb6fgg_j-GIRb4dZiq-9KUP_p_xZWwGzoRhexhbT5SIuFN0YjjZi0As_iEIY08ZQLY3RNm-bEyZ4KojvSLbSZWrPoBsXMImEiKF_FYsmabhYGApvPZYZHqNeGR0gWXfaV2P9MmtaBWuh0kOZae6OI9PTKuoN9TEZ-qsbNS3d5lIJPmzs4aq4FM1JFuEvkeXM3LjfNV08W';

// Функция для сохранения токенов в localStorage
const saveTokens = (tokens) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
};

// Функция для загрузки токенов из localStorage
const loadTokens = () => {
    const tokens = localStorage.getItem(TOKEN_STORAGE_KEY);
    return tokens ? JSON.parse(tokens) : null;
};

// Функция для инициализации токенов при первом запуске
const initializeTokens = () => {
    const existingTokens = loadTokens();
    if (!existingTokens) {
        const tokens = {
            access_token: INITIAL_ACCESS_TOKEN,
            refresh_token: INITIAL_REFRESH_TOKEN,
            expires_at: Date.now() + (14340 * 1000) // 4 часа - 1 минута
        };
        saveTokens(tokens);
        console.log("✅ Токены инициализированы");
    }
};

// Функция для обновления access token с помощью refresh token
const refreshAccessToken = async (refreshToken) => {
    try {
        console.log("🔄 Обновляем access token...");
        
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: DROPBOX_CLIENT_ID,
                client_secret: DROPBOX_CLIENT_SECRET,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка HTTP:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Токен успешно обновлен");
        
        return data.access_token;
        
    } catch (error) {
        console.error('❌ Ошибка обновления токена:', error);
        throw error;
    }
};

// Основная функция инициализации Dropbox с автоматическим обновлением токена
const ensureDropboxInitialized = async () => {
    if (isDropboxInitialized && dropbox) return true;
    
    try {
        console.log("🔄 Инициализация Dropbox...");
        
        // Инициализируем токены при первом запуске
        initializeTokens();
        
        // Загружаем сохраненные токены
        let tokens = loadTokens();
        
        if (!tokens) {
            throw new Error("Токены не найдены");
        }
        
        console.log("🔍 Проверяем срок действия токена...");
        
        // Проверяем, не истек ли access token (с запасом в 5 минут)
        const now = Date.now();
        const tokenExpired = now >= (tokens.expires_at - 300000); // 5 минут запаса
        
        if (tokenExpired) {
            console.log('🔄 Access token истек или скоро истечет, обновляем...');
            const newAccessToken = await refreshAccessToken(tokens.refresh_token);
            tokens.access_token = newAccessToken;
            tokens.expires_at = Date.now() + (14340 * 1000); // 4 часа
            saveTokens(tokens);
            console.log("✅ Токен успешно обновлен");
        } else {
            console.log("✅ Токен действителен");
        }
        
        // Инициализируем Dropbox с актуальным токеном
        dropbox = new Dropbox.Dropbox({
            accessToken: tokens.access_token,
            fetch: window.fetch.bind(window)
        });
        
        // Проверяем подключение простым запросом
        try {
            await dropbox.filesListFolder({ path: '' });
            console.log("✅ Dropbox подключен успешно");
        } catch (authError) {
            console.log("🔄 Проверка подключения не удалась, пробуем обновить токен...");
            const newAccessToken = await refreshAccessToken(tokens.refresh_token);
            tokens.access_token = newAccessToken;
            tokens.expires_at = Date.now() + (14340 * 1000);
            saveTokens(tokens);
            
            // Повторно инициализируем Dropbox
            dropbox = new Dropbox.Dropbox({
                accessToken: newAccessToken,
                fetch: window.fetch.bind(window)
            });
            
            // Проверяем еще раз
            await dropbox.filesListFolder({ path: '' });
        }
        
        isDropboxInitialized = true;
        console.log("✅ Dropbox инициализирован с автоматическим обновлением токена");
        return true;
        
    } catch (error) {
        console.error("❌ Ошибка инициализации Dropbox:", error);
        
        // Пробуем использовать статический токен как запасной вариант
        try {
            console.log("🔄 Пробуем использовать резервный токен...");
            dropbox = new Dropbox.Dropbox({
                accessToken: INITIAL_ACCESS_TOKEN,
                fetch: window.fetch.bind(window)
            });
            
            // Проверяем подключение с резервным токеном
            await dropbox.filesListFolder({ path: '' });
            
            isDropboxInitialized = true;
            console.log("✅ Dropbox инициализирован с резервным токеном");
            return true;
        } catch (fallbackError) {
            console.error("❌ Ошибка инициализации с резервным токеном:", fallbackError);
            
            // Показываем пользователю понятное сообщение
            if (confirm("Ошибка подключения к Dropbox. Хотите попробовать перезагрузить страницу?")) {
                location.reload();
            }
            return false;
        }
    }
};
// Функция для безопасного выполнения Dropbox запросов с автоматическим обновлением токена
const safeDropboxRequest = async (requestFn, maxRetries = 2) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Убеждаемся, что Dropbox инициализирован
            await ensureDropboxInitialized();
            
            // Выполняем запрос через ограничитель
            return await requestQueue.add(async () => {
                return await requestFn();
            });
            
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Попытка ${attempt + 1} не удалась:`, error);
            
            // Для 429 ошибок - увеличиваем задержку
            if (error.status === 429 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Экспоненциальная задержка
                console.log(`🔄 429 ошибка, ждем ${delay}ms перед повторной попыткой...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            if (error.status === 401 && attempt < maxRetries) {
                // Если 401 ошибка, сбрасываем инициализацию и пробуем снова
                console.log("🔄 401 ошибка, сбрасываем кэш и пробуем снова...");
                isDropboxInitialized = false;
                folderCache.clear();
                filesCache.clear();
                continue;
            }
            
            if (attempt === maxRetries) {
                console.error("❌ Все попытки не удались");
                throw error;
            }
        }
    }
    
    throw lastError;
};
// Ограничитель запросов для избежания 429 ошибок
const requestQueue = {
    queue: [],
    processing: false,
    
    async add(requestFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ requestFn, resolve, reject });
            this.process();
        });
    },
    
    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        // Задержка между запросами (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { requestFn, resolve, reject } = this.queue.shift();
        
        try {
            const result = await requestFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process();
        }
    }
};

// Проверка существования папки пользователя
const checkUserFolder = async (username) => {
    if (!ensureDropboxInitialized()) return false;
    try {
        await dropbox.filesGetMetadata({ 
            path: `/Генератор документов/${username}` 
        });
        return true;
    } catch (e) {
        if (e.status === 409) {
            console.log(`Папка пользователя ${username} не найдена, нужно создать`);
            return false;
        }
        console.error("Ошибка проверки папки:", e);
        throw e;
    }
};

// Регистрация нового пользователя
const registerUser = async (username) => {
    if (!ensureDropboxInitialized()) return;
    try {
        console.log("📝 Регистрация нового пользователя:", username);
        
        // Сначала проверяем/создаем основную папку "Генератор документов"
        try {
            await dropbox.filesGetMetadata({ 
                path: '/Генератор документов' 
            });
            console.log("✅ Основная папка существует");
        } catch (e) {
            if (e.status === 409) {
                console.log("📁 Создаем основную папку 'Генератор документов'");
                await dropbox.filesCreateFolderV2({ 
                    path: '/Генератор документов',
                    autorename: false
                });
            } else {
                throw e;
            }
        }
        
        // Создаем папку пользователя
        await dropbox.filesCreateFolderV2({
            path: `/Генератор документов/${username}`,
            autorename: false
        });
        
        // Создаем файл структуры папок
        const defaultStructure = {
            version: "1.0",
            lastUpdated: new Date().toISOString(),
            folders: []
        };

        await dropbox.filesUpload({
            path: `/Генератор документов/${username}/${FOLDERS_STRUCTURE_FILE}`,
            contents: JSON.stringify(defaultStructure, null, 2),
            mode: { '.tag': 'overwrite' },
            mute: true
        });

        console.log("✅ Файл структуры папок создан");
        
        // Создаем файл для получателей
        await dropbox.filesUpload({
            path: `/Генератор документов/${username}/recipients.json`,
            contents: JSON.stringify([]),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        
        // Создаем файл профиля отправителя
        const defaultProfile = {
            senderPosition: "",
            senderOrganization: "",
            senderName: "",
            isLocked: true
        };
        
        await dropbox.filesUpload({
            path: `/Генератор документов/${username}/${SENDER_PROFILE_FILE}`,
            contents: JSON.stringify(defaultProfile),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        
        console.log("✅ Пользователь зарегистрирован:", username);
    } catch (error) {
        console.error("❌ Ошибка регистрации:", error);
        if (error.status === 409) {
            throw new Error("Папка уже существует или имя занято");
        }
        throw error;
    }
};

// Кэш для хранения структуры папок
const folderCache = new Map();

// Загрузка получателей
const loadRecipients = async (username) => {
    if (!username) return [];
    
    return await safeDropboxRequest(async () => {
        const response = await dropbox.filesDownload({ 
            path: `/Генератор документов/${username}/recipients.json` 
        });
        
        let content;
        if (response.result && response.result.fileBlob) {
            content = await response.result.fileBlob.text();
        } else if (response.fileBlob) {
            content = await response.fileBlob.text();
        } else {
            throw new Error("Неверный формат ответа от Dropbox");
        }
        
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
    }).catch(error => {
        console.error("Ошибка загрузки получателей:", error);
        
        // Если файла нет - создаем его
        if (error.status === 409) {
            try {
                return safeDropboxRequest(async () => {
                    await dropbox.filesUpload({
                        path: `/Генератор документов/${username}/recipients.json`,
                        contents: JSON.stringify([]),
                        mode: { '.tag': 'overwrite' },
                        mute: true
                    });
                    return [];
                });
            } catch (uploadError) {
                console.error("Ошибка создания файла получателей:", uploadError);
            }
        }
        return [];
    });
};

// Сохранение получателей
const saveRecipients = async (username, recipients) => {
    if (!ensureDropboxInitialized()) throw new Error("Dropbox не инициализирован");
    
    try {
        await dropbox.filesUpload({
            path: `/Генератор документов/${username}/recipients.json`,
            contents: JSON.stringify(recipients),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        return true;
    } catch (error) {
        console.error("Ошибка сохранения получателей:", error);
        throw error;
    }
};
// Загрузка профиля отправителя
const loadSenderProfile = async (username) => {
    if (!username) return null;
    
    return await safeDropboxRequest(async () => {
        const response = await dropbox.filesDownload({ 
            path: `/Генератор документов/${username}/${SENDER_PROFILE_FILE}` 
        });
        
        let content;
        if (response.result && response.result.fileBlob) {
            content = await response.result.fileBlob.text();
        } else if (response.fileBlob) {
            content = await response.fileBlob.text();
        } else {
            throw new Error("Неверный формат ответа от Dropbox");
        }
        
        return JSON.parse(content);
    }).catch(error => {
        console.error("Ошибка загрузки профиля отправителя:", error);
        
        // Если файла нет - создаем пустой профиль
        if (error.status === 409) {
            const defaultProfile = {
                senderPosition: "",
                senderOrganization: "", 
                senderName: "",
                isLocked: true
            };
            
            try {
                return safeDropboxRequest(async () => {
                    await saveSenderProfile(username, defaultProfile);
                    return defaultProfile;
                });
            } catch (uploadError) {
                console.error("Ошибка создания профиля отправителя:", uploadError);
            }
        }
        return null;
    });
};

// Сохранение профиля отправителя
const saveSenderProfile = async (username, profile) => {
    if (!ensureDropboxInitialized()) throw new Error("Dropbox не инициализирован");
    
    try {
        await dropbox.filesUpload({
            path: `/Генератор документов/${username}/${SENDER_PROFILE_FILE}`,
            contents: JSON.stringify(profile),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        return true;
    } catch (error) {
        console.error("Ошибка сохранения профиля отправителя:", error);
        throw error;
    }
};

// Кэш для файлов
const filesCache = new Map();

// Загрузка всех файлов писем
const loadAllFiles = async (username) => {
    if (!username) {
        return new Map();
    }
    
    return await safeDropboxRequest(async () => {
        const userRootPath = `/Генератор документов/${username}`;
        
        console.log("📂 Начинаем загрузку файлов из:", userRootPath);
        
        // Загружаем все файлы с пагинацией
        let allEntries = [];
        let hasMore = true;
        let cursor = null;
        let requestCount = 0;

        while (hasMore && requestCount < 10) { // Ограничиваем максимум 10 запросов
            requestCount++;
            console.log(`📄 Запрос файлов ${requestCount}...`);
            
            let result;
            if (cursor) {
                result = await dropbox.filesListFolderContinue({ cursor });
            } else {
                result = await dropbox.filesListFolder({ 
                    path: userRootPath,
                    recursive: true,
                    limit: 500 // Уменьшаем лимит для избежания 429
                });
            }

            if (result.result.entries) {
                allEntries = allEntries.concat(result.result.entries);
                console.log(`✅ Получено записей: ${result.result.entries.length}, всего: ${allEntries.length}`);
            }

            hasMore = result.result.has_more;
            cursor = result.result.cursor;
            
            // Добавляем задержку между запросами пагинации
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`📊 Всего загружено записей: ${allEntries.length}`);
        
        // Фильтруем только файлы писем (исключаем служебные файлы)
        const letterFiles = allEntries.filter(entry => 
            entry['.tag'] === 'file' && 
            entry.name.endsWith('.json') && 
            entry.name !== FOLDERS_STRUCTURE_FILE &&
            entry.name !== RECIPIENTS_FILE &&
            entry.name !== SENDER_PROFILE_FILE
        );
        
        console.log("📄 Найдено файлов писем:", letterFiles.length);
        
        // Группируем по путям папок
        const filesByPath = new Map();
        
        letterFiles.forEach(file => {
            const fullPath = file.path_display;
            // Получаем путь относительно папки пользователя
            const relativePath = fullPath
                .replace(`/Генератор документов/${username}/`, '')
                .replace(/\.json$/, '');
            
            // Определяем папку (убираем имя файла)
            let folderPath = '';
            if (relativePath.includes('/')) {
                folderPath = relativePath.split('/').slice(0, -1).join('/');
            }
            
            if (!filesByPath.has(folderPath)) {
                filesByPath.set(folderPath, []);
            }
            
            filesByPath.get(folderPath).push({
                id: file.id,
                name: file.name.replace('.json', ''),
                path: relativePath,
                fullPath: file.path_display
            });
        });
        
        console.log("📁 Сгруппировано по папкам:", filesByPath.size);
        return filesByPath;
        
    }).catch(error => {
        console.error("❌ Ошибка загрузки файлов:", error);
        return new Map();
    });
};

// Универсальная функция показа загрузки
const showLoading = (message = "Загрузка...", type = "full") => {
    const loadingEl = type === "full" ? 
        document.getElementById('universalLoading') : 
        document.getElementById('miniLoading');
    
    const messageEl = loadingEl.querySelector('.loading-text');
    messageEl.textContent = message;
    
    loadingEl.style.display = 'flex';
    loadingEl.classList.remove('fade-out');
    loadingEl.classList.add('fade-in');
    
    return {
        hide: () => {
            loadingEl.classList.remove('fade-in');
            loadingEl.classList.add('fade-out');
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 300);
        },
        updateMessage: (newMessage) => {
            messageEl.textContent = newMessage;
        }
    };
};
// Анимация "письмо влетает в папку"
const animateLetterToFolder = (folderElement, letterElement) => {
    return new Promise((resolve) => {
        // Создаем летающий элемент письма
        const flyingLetter = document.createElement('div');
        flyingLetter.innerHTML = '📄';
        flyingLetter.className = 'letter-flying';
        flyingLetter.style.fontSize = '24px';
        
        // Получаем позиции элементов
        const letterRect = letterElement.getBoundingClientRect();
        const folderRect = folderElement.getBoundingClientRect();
        
        // Начальная позиция (где письмо)
        flyingLetter.style.left = letterRect.left + 'px';
        flyingLetter.style.top = letterRect.top + 'px';
        
        // Конечная позиция (где папка)
        const targetX = folderRect.left - letterRect.left;
        const targetY = folderRect.top - letterRect.top;
        
        // Устанавливаем CSS переменные для анимации
        flyingLetter.style.setProperty('--fly-x', targetX + 'px');
        flyingLetter.style.setProperty('--fly-y', targetY + 'px');
        
        // Добавляем в DOM
        document.body.appendChild(flyingLetter);
        
        // После завершения анимации удаляем элемент и резолвим промис
        setTimeout(() => {
            document.body.removeChild(flyingLetter);
            resolve();
        }, 1000);
    });
};

// Специализированные функции загрузки
const showLetterLoading = () => showLoading("Генерируем письмо...", "full");
const showSaveLoading = () => showLoading("Сохраняем письмо...", "mini");
const showRecipientLoading = () => showLoading("Добавляем получателя...", "mini");
const showRefreshLoading = () => showLoading("Обновляем данные...", "mini");
const showEditLoading = () => showLoading("Загружаем письмо...", "mini");
const showDeleteLoading = () => showLoading("Удаляем письмо...", "mini");
const showFolderCreationLoading = () => showLoading("Создаем папку...", "mini");
const showFolderDeletionLoading = () => showLoading("Удаляем папку...", "mini");

const hideLoading = (modal) => {
    if (modal) modal.hide();
};

const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("ru", { month: "long" });
    const year = date.getFullYear();
    return `"${day}" ${month} ${year} г.`;
};

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Создание Vue приложения
const app = createApp({
    setup() {
        const user = ref({
            username: null,
            folders: [],
            files: [],
            recipients: [],
            senderProfile: null
        });
        
        // Добавить защиту от undefined при обращении к user.username
        const safeUsername = computed(() => user.value?.username || null);
        const showSuccessNotification = ref(false);
        const isLoadingRecipients = ref(false);
        const showErrorNotification = ref(false);
        const notificationMessage = ref('');
        const recipientSearch = ref('');
        const newRecipient = ref({ name: '', position: '', organization: '' });
        const selectedFolderPath = ref(null);

        const saveFileName = ref(''); // Для имени файла при сохранении
        const isEditingExistingFile = ref(false); // Режим редактирования
        const currentEditingFile = ref(null); // Текущий редактируемый файл
        const showLetterForm = ref(false);
        const showSenderProfileModal = ref(false);
        const senderProfileForm = ref({
            senderPosition: "",
            senderOrganization: "", 
            senderName: "",
            isLocked: true
        });
        const formData = ref({
            currentSelection: null,
            letter: {
                number: "",
                date: new Date().toISOString().split('T')[0],
                recipients: [{ position: "", organization: "", name: "" }],
                objectName: "",
                title: "",
                content: "",
                senderPosition: "",
                senderOrganization: "",
                senderName: ""
            },
            currentPath: "",
            currentFileId: null
        });

        // Вычисляемое свойство для блокировки полей отправителя
        const isSenderLocked = computed(() => {
            return user.value.senderProfile?.isLocked || false;
        });

        const showNotification = (message, type = 'success') => {
            notificationMessage.value = message;
            if (type === 'success') {
                showSuccessNotification.value = true;
                setTimeout(() => {
                    showSuccessNotification.value = false;
                }, 3000);
            } else {
                showErrorNotification.value = true;
                setTimeout(() => {
                    showErrorNotification.value = false;
                }, 5000);
            }
        };

// Загрузка данных пользователя
const loadUserData = async () => {
    if (!user.value.username) return;
    
    try {
        console.log("🚀 Загрузка данных для:", user.value.username);
        
        // Загружаем данные ПОСЛЕДОВАТЕЛЬНО чтобы избежать 429 ошибок
        console.log("1. Загружаем получателей...");
        const recipients = await loadRecipients(user.value.username);
        
        console.log("2. Загружаем структуру папок...");
        const folders = await loadFoldersFromJSON(user.value.username);
        
        console.log("3. Загружаем файлы...");
        const allFiles = await loadAllFiles(user.value.username);
        
        console.log("4. Загружаем профиль...");
        const senderProfile = await loadSenderProfile(user.value.username);
        
        console.log("📊 Данные получены:", {
            папки: folders.length,
            получатели: recipients.length,
            файлы: allFiles.size,
            профиль: senderProfile ? "загружен" : "нет"
        });
        
        // Функция для подсчета файлов в папке и её подпапках
        const countFilesRecursive = (folder, filesMap) => {
            let totalFiles = 0;
            
            // Файлы в текущей папке
            const currentFiles = filesMap.get(folder.path) || [];
            totalFiles += currentFiles.length;
            
            // Рекурсивно считаем файлы в подпапках
            if (folder.children && folder.children.length > 0) {
                folder.children.forEach(child => {
                    totalFiles += countFilesRecursive(child, filesMap);
                });
            }
            
            return totalFiles;
        };
        
        // Объединяем папки с файлами и считаем общее количество
        const attachFiles = (folderList) => {
            return folderList.map(folder => {
                const files = allFiles.get(folder.path) || [];
                const children = folder.children ? attachFiles(folder.children) : [];
                
                // Считаем общее количество файлов (включая подпапки)
                const totalFilesCount = countFilesRecursive({...folder, children}, allFiles);
                
                return {
                    ...folder,
                    files: files,
                    filesCount: totalFilesCount, // Общее количество файлов
                    children: children
                };
            });
        };
        
        user.value.folders = attachFiles(folders);
        user.value.recipients = recipients;
        user.value.files = allFiles.get(formData.value.currentPath) || [];
        
        // Загружаем профиль отправителя если есть
        if (senderProfile) {
            user.value.senderProfile = senderProfile;
            
            // Если профиль заблокирован - автоматически заполняем данные отправителя
            if (senderProfile.isLocked) {
                formData.value.letter.senderPosition = senderProfile.senderPosition || "";
                formData.value.letter.senderOrganization = senderProfile.senderOrganization || "";
                formData.value.letter.senderName = senderProfile.senderName || "";
            }
        }
        
        console.log("✅ Данные обновлены с профилем отправителя!");
        
    } catch (error) {
        console.error("❌ Ошибка загрузки:", error);
        showNotification("Ошибка загрузки", "error");
    }
};
// Улучшенный кэш с временем жизни
const createCache = (defaultTTL = 300000) => { // 5 минут по умолчанию
    return {
        data: new Map(),
        
        set(key, value, ttl = defaultTTL) {
            this.data.set(key, {
                value,
                expiry: Date.now() + ttl
            });
        },
        
        get(key) {
            const item = this.data.get(key);
            if (!item) return null;
            
            if (Date.now() > item.expiry) {
                this.data.delete(key);
                return null;
            }
            
            return item.value;
        },
        
        delete(key) {
            this.data.delete(key);
        },
        
        clear() {
            this.data.clear();
        }
    };
};

// Обновляем кэши
const folderCache = createCache(600000); // 10 минут для структуры папок
const filesCache = createCache(300000);  // 5 минут для файлов

// Вход пользователя
const login = async () => {
    const username = prompt("Введите имя пользователя (только латинские буквы и цифры):");
    if (!username) return;
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        alert("Имя пользователя может содержать только латинские буквы, цифры, _ и -");
        return;
    }
    
    try {
        if (!ensureDropboxInitialized()) return;
        
        const exists = await checkUserFolder(username);
        if (!exists) {
            if (confirm("Пользователь не найден. Создать нового?")) {
                await registerUser(username);
            } else {
                return;
            }
        }
        
        user.value.username = username;
        localStorage.setItem('dbx_username', username);
        await loadUserData();
        instantRefresh();
        
        // Автоматически загружаем данные профиля в форму
        if (user.value.senderProfile) {
            senderProfileForm.value = { ...user.value.senderProfile };
        }
        
    } catch (error) {
        console.error("Ошибка входа:", error);
        alert("Ошибка входа: " + error.message);
    }
};

        // Выход
        const logout = () => {
            user.value = { username: null, folders: [], files: [], recipients: [] };
            formData.value.currentPath = "";
            localStorage.removeItem('dbx_username');
        };

        // Создание новой папки
        const createFolder = async () => {
            await createSubFolder('');
        };

        const deleteFolder = async (path) => {
            if (!confirm(`Удалить папку "${path.split('/').pop()}" и ВСЕ её содержимое (включая письма)?`)) return;
            
            let loading = null;
            try {
                loading = showFolderDeletionLoading();
                
                // Сначала получаем все файлы пользователя, чтобы найти файлы в удаляемой папке
                const allFiles = await loadAllFiles(user.value.username);
                
                // Находим все файлы в этой папке и её подпапках
                const filesToDelete = [];
                
                const collectFilesFromFolder = (folderPath) => {
                    // Файлы в текущей папке
                    const currentFiles = allFiles.get(folderPath) || [];
                    filesToDelete.push(...currentFiles);
                    
                    // Ищем подпапки и их файлы
                    const findSubfolders = (folders, targetPath) => {
                        for (let folder of folders) {
                            if (folder.path === targetPath) {
                                // Рекурсивно собираем файлы из подпапок
                                if (folder.children && folder.children.length > 0) {
                                    folder.children.forEach(child => {
                                        const childFiles = allFiles.get(child.path) || [];
                                        filesToDelete.push(...childFiles);
                                        // Рекурсивно для вложенных подпапок
                                        findSubfolders(folder.children, child.path);
                                    });
                                }
                                return true;
                            }
                            if (folder.children && folder.children.length > 0) {
                                if (findSubfolders(folder.children, targetPath)) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    };
                    
                    findSubfolders(user.value.folders, folderPath);
                };
                
                collectFilesFromFolder(path);
                
                console.log(`🗑️ Удаляем папку "${path}" и ${filesToDelete.length} файлов внутри`);
                
                // Удаляем все файлы в папке
                for (const file of filesToDelete) {
                    try {
                        const filePath = file.fullPath || `/Генератор документов/${user.value.username}/${file.path}.json`;
                        await dropbox.filesDeleteV2({ path: filePath });
                        console.log(`✅ Удален файл: ${file.name}`);
                    } catch (fileError) {
                        console.warn(`⚠️ Не удалось удалить файл ${file.name}:`, fileError);
                    }
                }
                
                // Загружаем текущую структуру
                const currentFolders = await loadFoldersFromJSON(user.value.username);
                
                // Функция для удаления папки из структуры
                const removeFolder = (folders, targetPath) => {
                    for (let i = 0; i < folders.length; i++) {
                        if (folders[i].path === targetPath) {
                            // Удаляем папку
                            folders.splice(i, 1);
                            return true;
                        }
                        if (folders[i].children && folders[i].children.length > 0) {
                            if (removeFolder(folders[i].children, targetPath)) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                
                if (!removeFolder(currentFolders, path)) {
                    throw new Error("Папка не найдена в структуре");
                }
                
                // Сохраняем обновленную структуру
                await saveFoldersToJSON(user.value.username, currentFolders);
                
                // Обновляем интерфейс
                await loadUserData();
                
                showNotification(`Папка и ${filesToDelete.length} писем удалены!`);
                
            } catch (error) {
                console.error("❌ Ошибка удаления:", error);
                showNotification("Не удалось удалить папку", "error");
            } finally {
                if (loading) {
                    setTimeout(() => loading.hide(), 300);
                }
            }
        };

        const changeFolder = async (path) => {
            console.log("📁 Выбрана папка:", path);
            formData.value.currentPath = path;
            
            // Просто обновляем файлы для выбранной папки
            const allFiles = await loadAllFiles(user.value.username);
            user.value.files = allFiles.get(path) || [];
        };

// Управление письмами
const loadLetter = async (file) => {
    let loading = null;
    try {
        // Показываем анимацию загрузки для редактирования
        loading = showEditLoading();
        
        const basePath = '/Генератор документов';
        
        // Используем полный путь из объекта file
        const filePath = file.fullPath || 
            (file.path 
                ? `${basePath}/${user.value.username}/${file.path}.json`
                : `${basePath}/${user.value.username}/${file.name}.json`);
            
        console.log("📂 Загрузка письма по пути:", filePath);
        
        const response = await dropbox.filesDownload({ path: filePath });
        
        let content;
        // ПРАВИЛЬНАЯ обработка ответа от Dropbox
        if (response.result && response.result.fileBlob) {
            content = await response.result.fileBlob.text();
        } else if (response.fileBlob) {
            content = await response.fileBlob.text();
        } else {
            throw new Error("Неверный формат ответа от Dropbox");
        }
        
        const data = JSON.parse(content);
        formData.value.letter = {
            ...data,
            recipients: data.recipients || [{ position: "", organization: "", name: "" }]
        };
        formData.value.currentFileId = file.id;
        
        // Устанавливаем режим редактирования
        isEditingExistingFile.value = true;
        currentEditingFile.value = file;
        
        // ПОКАЗЫВАЕМ ФОРМУ ПИСЬМА
        showLetterForm.value = true;
        // Инициализируем редактируемое поле с задержкой для гарантии отрисовки DOM
        setTimeout(() => {
            const editable = document.getElementById('letterContentEditable');
            if (editable && formData.value.letter.content) {
                editable.innerHTML = formData.value.letter.content;
            }
        }, 100);
        
        // Показываем уведомление об успешной загрузке
        showNotification("Письмо загружено для редактирования!");
        
    } catch (error) {
        console.error("❌ Ошибка загрузки:", error);
        showNotification("Не удалось загрузить письмо: " + error.message, "error");
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 300);
        }
    }
};

const deleteLetter = async (file) => {
    if (!confirm(`Удалить письмо "${file.name}"?`)) return;
    
    let loading = null;
    try {
        // Показываем анимацию загрузки для удаления
        loading = showDeleteLoading();
        await loadUserData();
        const basePath = '/Генератор документов';
        
        // Используем правильный путь к файлу
        const filePath = file.path 
            ? `${basePath}/${user.value.username}/${file.path}.json`
            : `${basePath}/${user.value.username}/${file.name}.json`;
            
        console.log("🗑️ Удаление файла по пути:", filePath);
        
        await dropbox.filesDeleteV2({ path: filePath });
        
        // ОБНОВЛЯЕМ ДАННЫЕ СРАЗУ ПОСЛЕ УДАЛЕНИЯ
        await loadUserData();
        showNotification("Письмо удалено!");
    } catch (error) {
        console.error("❌ Ошибка удаления:", error);
        showNotification("Не удалось удалить письмо: " + error.message, "error");
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 300);
        }
    }
};

// Полная генерация письма DOCX
const generateLetter = async (generatePdfFlag = false) => {
    let loading = null;
    try {
        // Используем правильную анимацию загрузки
        loading = showLetterLoading();

        // Загрузка шаблона
        let response;
        const templatePaths = [
            './letter-template.docx',
            'letter-template.docx',
            '/letter-template.docx'
        ];
        
        for (const path of templatePaths) {
            try {
                response = await fetch(path);
                if (response.ok) break;
            } catch (e) {
                continue;
            }
        }
        
        if (!response || !response.ok) {
            throw new Error("Не удалось загрузить шаблон письма. Убедитесь, что файл letter-template.docx находится в той же папке, что и index.html");
        }

        // Работа с DOCX
        const zip = await JSZip.loadAsync(await response.arrayBuffer());
        const docXmlFile = zip.file("word/document.xml");
        if (!docXmlFile) {
            throw new Error("В шаблоне не найден файл document.xml");
        }
        
        let docXml = await docXmlFile.async("text");

        // Форматирование получателей
        const recipientsText = formData.value.letter.recipients
            .filter(r => r.position || r.organization || r.name)
            .map(r => {
                const firstLine = [r.position, r.organization].filter(Boolean).join(' ');
                return firstLine + (r.name ? `</w:t><w:br/><w:t>${r.name}` : '');
            })
            .join('</w:t><w:br/><w:t></w:t><w:br/><w:t>');

        // Форматирование содержания
        const formattedContent = formData.value.letter.content
            .split(/\r?\n/)
            .map(paragraph => paragraph || ' ')
            .join('</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>');
        
        // Замена плейсхолдеров
        const recipientsPattern = /(\<w:t[^>]*>)\[(\<\/w:t\>.*?\<w:t[^>]*>)RECIPIENTS_BLOCK(\<\/w:t\>.*?\<w:t[^>]*>)\](\<\/w:t\>)/gi;
        docXml = docXml.replace(recipientsPattern, `$1${recipientsText}$4`);
        
        const signLinePattern = /(\<w:t[^>]*>)\[(\<\/w:t\>.*?\<w:t[^>]*>)SIGN_LINE(\<\/w:t\>.*?\<w:t[^>]*>)\](\<\/w:t\>)/gi;
        docXml = docXml.replace(signLinePattern, formData.value.letter.senderName.trim() ? `$1________________$4` : `$1$4`);
        
        const replacements = {
            "[NUMBER]": formData.value.letter.number,
            "[DATE]": formatDate(formData.value.letter.date),
            "[OBJECT]": formData.value.letter.objectName,
            "[TITLE]": formData.value.letter.title,
"[CONTENT]": (() => {
    let content = formData.value.letter.content;
    
    // Сначала обрабатываем переводы строк
    content = content.replace(/<br\s*\/?>/gi, '</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>');
    
    // Обрабатываем форматирование с помощью рекурсивной функции
    const processFormatting = (html) => {
        // Регулярные выражения для поиска форматирования
        const boldRegex = /<b>(.*?)<\/b>/gi;
        const italicRegex = /<i>(.*?)<\/i>/gi;
        const underlineRegex = /<u>(.*?)<\/u>/gi;
        
        let result = html;
        
        // Обрабатываем жирный текст
        result = result.replace(boldRegex, (match, text) => {
            return `</w:t></w:r><w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>${text}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>`;
        });
        
        // Обрабатываем курсив
        result = result.replace(italicRegex, (match, text) => {
            return `</w:t></w:r><w:r><w:rPr><w:i/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>${text}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>`;
        });
        
        // Обрабатываем подчеркнутый текст
        result = result.replace(underlineRegex, (match, text) => {
            return `</w:t></w:r><w:r><w:rPr><w:u w:val="single"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>${text}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>`;
        });
        
        return result;
    };
    
    // Применяем обработку форматирования
    content = processFormatting(content);
    
    // Удаляем все оставшиеся HTML теги
    content = content.replace(/<\/?[^>]+>/g, '');
    
    // Обрабатываем абзацы
    const paragraphs = content.split(/\r?\n/).map(p => p || ' ');
    
    // Формируем итоговый XML для содержания
    return paragraphs.join('</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:i/></w:rPr><w:t>');
})(),
            "[SENDER_POS]": formData.value.letter.senderPosition,
            "[SENDER_ORG]": formData.value.letter.senderOrganization,
            "[SIGN]": formData.value.letter.senderName
        };

        for (const [key, value] of Object.entries(replacements)) {
            docXml = docXml.replace(
                new RegExp(`(<w:t[^>]*>)([^<]*?)(${escapeRegExp(key)})([^<]*?)(</w:t>)`, "gi"),
                `$1$2${value}$4$5`
            );
        }

        zip.file("word/document.xml", docXml);

        // Скачивание файла
        const docxBlob = await zip.generateAsync({ type: "blob" });
        const fileName = formData.value.letter.number 
        ? `Письмо_${formData.value.letter.number.replace(/\//g, '_')}.docx`
        : `Письмо_${new Date().toISOString().split('T')[0]}.docx`;
        
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        // ВОЗВРАЩАЕМ ДАННЫЕ ДЛЯ СОХРАНЕНИЯ
        return {
            success: true,
            fileName: fileName,
            blob: docxBlob,
            letterData: formData.value.letter
        };

    } catch (error) {
        console.error("Ошибка генерации:", error);
        showNotification("Ошибка: " + error.message, "error");
        return { success: false, error: error.message };
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 500);
        }
    }
};
// Новая функция генерации с запросом сохранения
const generateLetterWithSavePrompt = async (isPdf = false) => {
    try {
        // Сначала генерируем письмо
        const result = await generateLetter(isPdf);
        
        if (!result.success) {
            return; // Если была ошибка, выходим
        }
        
        // Показываем модальное окно с вопросом о сохранении
        const modal = new bootstrap.Modal(document.getElementById('saveAfterGenerateModal'));
        modal.show();
        
        // Обработчики для кнопок модального окна
        const skipSaveBtn = document.getElementById('skipSaveBtn');
        const confirmSaveBtn = document.getElementById('confirmSaveAfterGenerateBtn');
        
        // Удаляем старые обработчики, если есть
        skipSaveBtn.onclick = null;
        confirmSaveBtn.onclick = null;
        
        // Нет - просто закрываем окно (письмо уже скачано)
        skipSaveBtn.onclick = () => {
            modal.hide();
            showNotification("Письмо скачано!");
        };
        
        // Да - показываем окно выбора папки для сохранения
        confirmSaveBtn.onclick = () => {
            modal.hide();
            
            // Устанавливаем имя файла по умолчанию
            saveFileName.value = formData.value.letter.number 
                ? `Письмо_${formData.value.letter.number.replace(/\//g, '_')}`
                : '';
            
            // Показываем модальное окно выбора папки
            const folderModal = new bootstrap.Modal(document.getElementById('folderModal'));
            folderModal.show();
            
            // Фокусируемся на поле ввода имени после открытия модального окна
            setTimeout(() => {
                const input = document.getElementById('fileNameInput');
                if (input) input.focus();
            }, 300);
        };
        
    } catch (error) {
        console.error("Ошибка в процессе генерации:", error);
        showNotification("Ошибка при генерации письма", "error");
    }
};

        // Управление получателями
        const saveRecipientToDB = async () => {
            let loading = null;
            try {
                if (!newRecipient.value.name.trim()) {
                    showNotification("Введите ФИО получателя", "error");
                    return;
                }
                
                const isDuplicate = user.value.recipients.some(recipient => 
                    recipient.name.toLowerCase() === newRecipient.value.name.trim().toLowerCase() &&
                    recipient.organization.toLowerCase() === newRecipient.value.organization.trim().toLowerCase()
                );
                
                if (isDuplicate) {
                    showNotification("Такой получатель уже существует в базе", "error");
                    return;
                }
                
                // Показываем анимацию загрузки
                loading = showRecipientLoading();
                
                const newRecipientData = {
                    id: Date.now().toString(),
                    name: newRecipient.value.name.trim(),
                    position: newRecipient.value.position.trim(),
                    organization: newRecipient.value.organization.trim()
                };
                
                console.log("💾 Сохранение получателя:", newRecipientData);
                
                const updatedRecipients = [...user.value.recipients, newRecipientData];
                
                // Сохраняем в Dropbox
                await saveRecipients(user.value.username, updatedRecipients);
                
                // Обновляем локальное состояние
                user.value.recipients = updatedRecipients;
                instantRefresh();
                
                // Сбрасываем форму
                newRecipient.value = { name: '', position: '', organization: '' };
                
                // Закрываем модальное окно
                const modal = bootstrap.Modal.getInstance(document.getElementById('recipientModal'));
                if (modal) {
                    modal.hide();
                }
                
                showNotification("Получатель успешно добавлен!");
                
            } catch (error) {
                console.error("❌ Ошибка сохранения получателя:", error);
                showNotification("Не удалось сохранить получателя: " + error.message, "error");
            } finally {
                if (loading) {
                    setTimeout(() => loading.hide(), 300);
                }
            }
        };

        const deleteRecipientFromDB = async (id) => {
            if (!confirm("Удалить этого получателя из базы?")) return;
            try {
                const updatedRecipients = user.value.recipients.filter(r => r.id !== id);
                await saveRecipients(user.value.username, updatedRecipients);
                user.value.recipients = updatedRecipients;
                instantRefresh(); // Добавляем обновление
                showNotification("Получатель удален!");
            } catch (error) {
                console.error("Ошибка удаления получателя:", error);
                showNotification("Не удалось удалить получателя", "error");
            }
        };

        // Computed properties
        const filteredRecipients = computed(() => {
            const search = recipientSearch.value.toLowerCase();
            if (!user.value.recipients) return [];
            
            return user.value.recipients
                .filter(r => 
                    (r.name && r.name.toLowerCase().includes(search)) || 
                    (r.organization && r.organization.toLowerCase().includes(search))
                )
                .sort((a, b) => {
                    const getLastName = (name) => (name || '').split(' ')[0] || '';
                    return getLastName(a.name).localeCompare(getLastName(b.name));
                });
        });

        // Watchers
        watch(() => user.value.username, (newUsername) => {
            if (newUsername) {
                loadUserData();
            }
        });

// Автоматическое обновление при активации вкладок
onMounted(() => {
    const savedUsername = localStorage.getItem('dbx_username');
    if (savedUsername) {
        user.value.username = savedUsername;
        loadUserData();
    }
    
    // Обновляем данные при переключении на вкладку с папками
    document.addEventListener('show.bs.tab', function (event) {
        if (event.target.id === 'letter-form-tab' && user.value.username) {
            // Небольшая задержка для плавности
            setTimeout(() => {
                loadUserData();
            }, 100);
        }
    });
});

// Оптимизированное принудительное обновление
const forceRefresh = async () => {
    if (user.value.username) {
        console.log("🔄 Оптимизированное обновление данных...");
        
        // Показываем правильную анимацию загрузки
        const loading = showRefreshLoading();
        
        try {
            // Очищаем кэш
            folderCache.clear();
            filesCache.clear();
            
            // Загружаем данные
            await loadUserData();
            showNotification("Данные обновлены!");
        } catch (error) {
            console.error("Ошибка обновления:", error);
            showNotification("Ошибка обновления данных", "error");
        } finally {
            // Скрываем индикатор
            setTimeout(() => {
                loading.hide();
            }, 500);
        }
    }
};

// Создание папки - ПРОСТАЯ ВЕРСИЯ
const createSubFolder = async (parentPath = '') => {
    if (!user.value.username) {
        alert("Сначала войдите в систему");
        return;
    }
    
    const folderName = prompt("Введите название папки:");
    if (!folderName?.trim()) return;
    
    const safeName = folderName.trim().replace(/[<>:"|?*]/g, "").replace(/\s+/g, " ");
    if (!safeName) {
        alert("Некорректное имя папки");
        return;
    }
    
    let loading = null;
    try {
        loading = showFolderCreationLoading();
        
        // Загружаем текущую структуру
        const currentFolders = await loadFoldersFromJSON(user.value.username);
        
        // Создаем новую папку
        const newFolder = {
            id: 'folder_' + Date.now(),
            name: safeName,
            path: parentPath ? `${parentPath}/${safeName}` : safeName,
            parentPath: parentPath || '',
            created: new Date().toISOString(),
            children: [],
            files: [],
            filesCount: 0
        };
        
        console.log("🆕 Создаем папку:", newFolder);
        
        // Если это корневая папка, просто добавляем
        if (!parentPath) {
            currentFolders.push(newFolder);
        } else {
            // Ищем родительскую папку рекурсивно
            const findAndAdd = (folders, targetPath, folderToAdd) => {
                for (let folder of folders) {
                    if (folder.path === targetPath) {
                        folder.children.push(folderToAdd);
                        return true;
                    }
                    if (folder.children && folder.children.length > 0) {
                        if (findAndAdd(folder.children, targetPath, folderToAdd)) {
                            return true;
                        }
                    }
                }
                return false;
            };
            
            if (!findAndAdd(currentFolders, parentPath, newFolder)) {
                throw new Error("Родительская папка не найдена");
            }
        }
        
        // Сохраняем обновленную структуру
        await saveFoldersToJSON(user.value.username, currentFolders);
        
        // Обновляем интерфейс
        await loadUserData();
        
        showNotification(`Папка "${safeName}" создана!`);
        
    } catch (error) {
        console.error("❌ Ошибка создания папки:", error);
        showNotification("Ошибка: " + error.message, "error");
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 300);
        }
    }
};

// Прямое сохранение при редактировании существующего письма
const confirmSaveDirect = async () => {
    let loading = null;
    try {
        if (!user.value.username) {
            alert("Сначала войдите в систему");
            return;
        }

        // Проверяем, что у нас есть редактируемый файл
        if (!currentEditingFile.value) {
            alert("Ошибка: не найден редактируемый файл");
            return;
        }

        // Используем путь и имя из редактируемого файла
        const basePath = '/Генератор документов';
        const fullPath = `${basePath}/${user.value.username}/${currentEditingFile.value.path}.json`;

        console.log("💾 Перезапись письма по пути:", fullPath);

        // Показываем анимацию сохранения
        loading = showSaveLoading();

        await dropbox.filesUpload({
            path: fullPath,
            contents: JSON.stringify(formData.value.letter),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        
        // ОБНОВЛЯЕМ ДАННЫЕ СРАЗУ ПОСЛЕ СОХРАНЕНИЯ
        await loadUserData();
        instantRefresh();
        showNotification("Письмо успешно обновлено!");
        
        // СКРЫВАЕМ ФОРМУ ПОСЛЕ СОХРАНЕНИЯ
        showLetterForm.value = false;
        
        // Сбрасываем режим редактирования
        isEditingExistingFile.value = false;
        currentEditingFile.value = null;
        
    } catch (error) {
        console.error("❌ Ошибка сохранения:", error);
        showNotification("Не удалось сохранить письмо: " + error.message, "error");
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 300);
        }
        
        // Закрываем модальное окно если оно открыто
        const modal = bootstrap.Modal.getInstance(document.getElementById('folderModal'));
        if (modal) {
            modal.hide();
        }
    }
};

const confirmSave = async () => {
    let loading = null;
    try {
        if (!user.value.username) {
            alert("Сначала войдите в систему");
            return;
        }

        if (!saveFileName.value.trim()) {
            alert("Введите название для письма");
            return;
        }

        loading = showSaveLoading();

        // Подготавливаем данные
        const fileName = saveFileName.value.trim().replace(/\//g, '_');
        const basePath = '/Генератор документов';
        
        // Определяем путь для сохранения
        let filePath;
        if (selectedFolderPath.value) {
            // Сохраняем в выбранной папке
            filePath = `${basePath}/${user.value.username}/${selectedFolderPath.value}/${fileName}.json`;
        } else {
            // Сохраняем в корне
            filePath = `${basePath}/${user.value.username}/${fileName}.json`;
        }

        console.log("💾 Сохранение письма:", filePath);

        // Сохраняем в Dropbox
        await dropbox.filesUpload({
            path: filePath,
            contents: JSON.stringify(formData.value.letter),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        
        // АНИМАЦИЯ: находим элемент папки и создаем анимацию
        if (selectedFolderPath.value) {
            const folderPath = selectedFolderPath.value;
            const folderName = folderPath.split('/').pop() || folderPath;
            
            // Находим элемент папки в дереве
            const folderElements = document.querySelectorAll('.folder-name');
            let targetFolderElement = null;
            
            for (let element of folderElements) {
                if (element.textContent.includes(folderName)) {
                    targetFolderElement = element;
                    break;
                }
            }
            
            // Создаем временный элемент письма для анимации
            const tempLetterElement = document.createElement('div');
            tempLetterElement.innerHTML = '📄';
            tempLetterElement.style.position = 'fixed';
            tempLetterElement.style.left = '50%';
            tempLetterElement.style.top = '50%';
            tempLetterElement.style.fontSize = '24px';
            tempLetterElement.style.zIndex = '10000';
            document.body.appendChild(tempLetterElement);
            
            // Запускаем анимацию если нашли папку
            if (targetFolderElement) {
                await animateLetterToFolder(targetFolderElement, tempLetterElement);
            }
            
            // Удаляем временный элемент
            document.body.removeChild(tempLetterElement);
        }
        
        // Обновляем данные
        await loadUserData();
        
        showNotification("Письмо сохранено с анимацией! ✨");
        
        // Закрываем форму
        showLetterForm.value = false;
        selectedFolderPath.value = null;
        saveFileName.value = '';
        
    } catch (error) {
        console.error("❌ Ошибка сохранения:", error);
        showNotification("Ошибка сохранения: " + error.message, "error");
    } finally {
        if (loading) {
            setTimeout(() => loading.hide(), 300);
        }
    }
};

// Функция для выбора папки в модальном окне
const selectFolderForSave = function(path) {
    // Если кликнули на уже выбранную папку - сбрасываем выбор
    if (selectedFolderPath.value === path) {
        selectedFolderPath.value = null;
    } else {
        selectedFolderPath.value = path === '' ? null : path;
    }
};
// Мгновенное обновление данных (без анимации)
const instantRefresh = async () => {
    if (user.value.username) {
        console.log("⚡ Мгновенное обновление данных...");
        
        try {
            // Очищаем кэш
            folderCache.clear();
            filesCache.clear();
            
            // Быстрая перезагрузка
            await loadUserData();
            
            // Принудительное обновление Vue - УБИРАЕМ ошибочный вызов
            // await app.config.globalProperties.$forceUpdate();
        } catch (error) {
            console.error("Ошибка мгновенного обновления:", error);
        }
    }
};
// Принудительное обновление из Dropbox
const forceRefreshFromDropbox = async () => {
    if (!user.value.username) return;
    
    console.log("🔄 ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ИЗ DROPBOX");
    const loading = showRefreshLoading();
    
    try {
        // ПОЛНОСТЬЮ очищаем все кэши
        folderCache.clear();
        filesCache.clear();
        
        // Загружаем свежие данные
        await loadUserData();
        
        showNotification("Данные полностью обновлены из Dropbox!");
    } catch (error) {
        console.error("❌ Ошибка принудительного обновления:", error);
        showNotification("Ошибка обновления данных", "error");
    } finally {
        setTimeout(() => loading.hide(), 500);
    }
};

// Загрузка структуры папок из JSON
const loadFoldersFromJSON = async (username) => {
    if (!username) {
        return [];
    }
    
    return await safeDropboxRequest(async () => {
        const filePath = `/Генератор документов/${username}/${FOLDERS_STRUCTURE_FILE}`;
        console.log("📂 Загрузка структуры из:", filePath);
        
        const response = await dropbox.filesDownload({ path: filePath });
        
        let content;
        if (response.result && response.result.fileBlob) {
            content = await response.result.fileBlob.text();
        } else if (response.fileBlob) {
            content = await response.fileBlob.text();
        } else {
            throw new Error("Неверный формат ответа от Dropbox");
        }
        
        const structure = JSON.parse(content);
        console.log("✅ Структура загружена, папок:", structure.folders?.length || 0);
        return structure.folders || [];
        
    }).catch(error => {
        if (error.status === 409) {
            console.log("📁 Файл структуры не найден, создаем новый");
            // Создаем базовую структуру
            const defaultStructure = {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                folders: []
            };
            
            return safeDropboxRequest(async () => {
                await dropbox.filesUpload({
                    path: `/Генератор документов/${username}/${FOLDERS_STRUCTURE_FILE}`,
                    contents: JSON.stringify(defaultStructure, null, 2),
                    mode: { '.tag': 'overwrite' },
                    mute: true
                });
                return [];
            });
        }
        console.error("❌ Ошибка загрузки структуры:", error);
        return [];
    });
};

// Сохранение структуры папок
const saveFoldersToJSON = async (username, folders) => {
    if (!ensureDropboxInitialized()) return;
    
    try {
        const filePath = `/Генератор документов/${username}/${FOLDERS_STRUCTURE_FILE}`;
        const structure = {
            version: "1.0",
            lastUpdated: new Date().toISOString(),
            folders: folders
        };
        
        await dropbox.filesUpload({
            path: filePath,
            contents: JSON.stringify(structure, null, 2),
            mode: { '.tag': 'overwrite' },
            mute: true
        });
        
        console.log("💾 Структура сохранена, папок:", folders.length);
        
    } catch (error) {
        console.error("❌ Ошибка сохранения структуры:", error);
        throw error;
    }
};

return {
    user,
    recipientSearch,
    newRecipient,
    selectedFolderPath,
    formData,
    filteredRecipients,
    showLetterForm,
    forceRefresh,
    createSubFolder,
    showSuccessNotification,
    showErrorNotification,
    notificationMessage,
    isLoadingRecipients,
    saveFileName,
    isEditingExistingFile,
    currentEditingFile,
    forceRefreshFromDropbox,
    // Свойства для профиля отправителя
    senderProfileForm,
    
    // Вычисляемые свойства для профиля
    isSenderLocked: computed(() => {
        return user.value.senderProfile?.isLocked || false;
    }),
    hasSenderData: computed(() => {
        return user.value.senderProfile && (
            user.value.senderProfile.senderPosition || 
            user.value.senderProfile.senderOrganization || 
            user.value.senderProfile.senderName
        );
    }),
    
    // Methods
    login,
    logout,
    createFolder,
    deleteFolder,
    changeFolder,
    loadLetter,
    deleteLetter,
    generateLetter,
    generateLetterWithSavePrompt,
    saveRecipient: saveRecipientToDB,
    deleteRecipient: deleteRecipientFromDB,
    showNotification,
    saveRecipientToDB,
    confirmSaveDirect,
    confirmSave,
    selectFolderForSave,
    
    // Методы для профиля отправителя
    saveSenderProfile: async () => {
        let loading = null;
        try {
            loading = showLoading("Сохраняем профиль...", "mini");
            
            // Сохраняем профиль в Dropbox
            await saveSenderProfile(user.value.username, senderProfileForm.value);
            
            // Обновляем локальный профиль
            user.value.senderProfile = { ...senderProfileForm.value };
            
            // Если профиль заблокирован - обновляем данные в текущем письме
            if (senderProfileForm.value.isLocked && showLetterForm.value) {
                formData.value.letter.senderPosition = senderProfileForm.value.senderPosition;
                formData.value.letter.senderOrganization = senderProfileForm.value.senderOrganization;
                formData.value.letter.senderName = senderProfileForm.value.senderName;
            }
            
            showNotification("✅ Настройки пользователя сохранены!");
            
        } catch (error) {
            console.error("❌ Ошибка сохранения профиля:", error);
            showNotification("❌ Не удалось сохранить профиль", "error");
        } finally {
            if (loading) {
                setTimeout(() => loading.hide(), 300);
            }
        }
    },
    
    loadSenderProfileData: () => {
        // Загружаем данные из текущего профиля в форму
        if (user.value.senderProfile) {
            senderProfileForm.value = { ...user.value.senderProfile };
            showNotification("📥 Данные профиля загружены в форму");
        } else {
            showNotification("ℹ️ Профиль еще не настроен", "error");
        }
    },
    
    openSenderProfileModal: () => {
        // Заполняем форму данными из текущего профиля
        if (user.value.senderProfile) {
            senderProfileForm.value = { ...user.value.senderProfile };
        }
        showSenderProfileModal.value = true;
    },
    
    closeSenderProfileModal: () => {
        showSenderProfileModal.value = false;
    },
    addRecipient: () => {
        formData.value.letter.recipients.push({
            position: "",
            organization: "",
            name: ""
        });
    },
    
    removeRecipient: (index) => {
        formData.value.letter.recipients.splice(index, 1);
    },
    // Новые методы для форматирования текста
updateContent(event) {
    formData.value.letter.content = event.target.innerHTML;
},

saveSelection() {
    const editable = document.getElementById('letterContentEditable');
    if (!editable) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        formData.value.currentSelection = selection.getRangeAt(0);
    }
},

// Обновленный метод форматирования текста
formatText(type) {
    const editable = document.getElementById('letterContentEditable');
    if (!editable) return;
    
    // Восстанавливаем выделение
    const selection = window.getSelection();
    if (formData.value.currentSelection) {
        selection.removeAllRanges();
        selection.addRange(formData.value.currentSelection);
    }
    
    // Если нет выделения, просто выходим
    if (selection.toString().length === 0) {
        showNotification("Выделите текст для форматирования", "error");
        return;
    }
    
    // Применяем форматирование
    document.execCommand(type, false, null);
    
    // Обновляем содержимое
    formData.value.letter.content = editable.innerHTML;
    
    // Сохраняем новое выделение
    this.saveSelection();
    
    // Фокусируемся обратно на editable div
    editable.focus();
},

// Метод очистки форматирования
clearFormatting() {
    const editable = document.getElementById('letterContentEditable');
    if (!editable) return;
    
    const selection = window.getSelection();
    if (formData.value.currentSelection) {
        selection.removeAllRanges();
        selection.addRange(formData.value.currentSelection);
    }
    
    if (selection.toString().length === 0) {
        showNotification("Выделите текст для очистки форматирования", "error");
        return;
    }
    
    // Очищаем форматирование
    document.execCommand('removeFormat', false, null);
    document.execCommand('unlink', false, null); // Убираем ссылки если есть
    
    // Обновляем содержимое
    formData.value.letter.content = editable.innerHTML;
    this.saveSelection();
    editable.focus();
},

// Метод для инициализации содержимого при загрузке письма
initEditableContent() {
    const editable = document.getElementById('letterContentEditable');
    if (editable && formData.value.letter.content) {
        editable.innerHTML = formData.value.letter.content;
    }
},
    
    addToLetter: (recipient) => {
        // Автоматически заполняем данные отправителя из профиля если он заблокирован
        const senderData = user.value.senderProfile?.isLocked ? {
            senderPosition: user.value.senderProfile.senderPosition || "",
            senderOrganization: user.value.senderProfile.senderOrganization || "",
            senderName: user.value.senderProfile.senderName || ""
        } : {
            senderPosition: "",
            senderOrganization: "", 
            senderName: ""
        };
        
        // ПРОВЕРЯЕМ, ОТКРЫТА ЛИ ФОРМА ПИСЬМА
        if (!showLetterForm.value) {
            showNotification("Сначала создайте новое письмо или откройте существующее для редактирования!", "error");
            
            // Предлагаем создать новое письмо
            if (confirm("Хотите создать новое письмо?")) {
                // Автоматически создаем новое письмо с данными отправителя
                formData.value.letter = {
                    number: "",
                    date: new Date().toISOString().split('T')[0],
                    recipients: [{ 
                        position: recipient.position,
                        organization: recipient.organization,
                        name: recipient.name
                    }],
                    objectName: "",
                    title: "",
                    content: "",
                    ...senderData  // Добавляем данные отправителя
                };
                formData.value.currentFileId = null;
                isEditingExistingFile.value = false;
                currentEditingFile.value = null;
                
                // Показываем форму
                showLetterForm.value = true;
                
                // Переключаемся на вкладку формы
                const tabEl = document.querySelector('a[href="#letter-form"]');
                if (tabEl) {
                    const tab = new bootstrap.Tab(tabEl);
                    tab.show();
                }
                
                // Показываем уведомление если используется профиль
                const hasData = user.value.senderProfile && (
                    user.value.senderProfile.senderPosition || 
                    user.value.senderProfile.senderOrganization || 
                    user.value.senderProfile.senderName
                );
                
                if (user.value.senderProfile?.isLocked && hasData) {
                    showNotification("✅ Данные отправителя автоматически заполнены из настроек!");
                }
            }
            return;
        }
        
        // Если форма открыта, просто добавляем получателя
        formData.value.letter.recipients.push({
            name: recipient.name,
            position: recipient.position,
            organization: recipient.organization
        });
        
        // Переключение на вкладку с формой
        const tabEl = document.querySelector('a[href="#letter-form"]');
        if (tabEl) {
            const tab = new bootstrap.Tab(tabEl);
            tab.show();
        }
        
        showNotification("Получатель добавлен в письмо!");
    },
    
    showAddRecipientModal: () => {
        newRecipient.value = { name: '', position: '', organization: '' };
        const modal = new bootstrap.Modal(document.getElementById('recipientModal'));
        modal.show();
    },
    
    onRecipientModalClose: () => {
        newRecipient.value = { name: '', position: '', organization: '' };
    },
    
    createNewLetter: () => {
        // Автоматически заполняем данные отправителя из профиля если он заблокирован
        const senderData = user.value.senderProfile?.isLocked ? {
            senderPosition: user.value.senderProfile.senderPosition || "",
            senderOrganization: user.value.senderProfile.senderOrganization || "",
            senderName: user.value.senderProfile.senderName || ""
        } : {
            senderPosition: "",
            senderOrganization: "", 
            senderName: ""
        };
        
        // Сбрасываем форму
        formData.value.letter = {
            number: "",
            date: new Date().toISOString().split('T')[0],
            recipients: [{ position: "", organization: "", name: "" }],
            objectName: "",
            title: "",
            content: "",
            ...senderData
        };
        formData.value.currentFileId = null;
        isEditingExistingFile.value = false;
        currentEditingFile.value = null;
        
        // Показываем форму
        showLetterForm.value = true;
        
        // Инициализируем редактируемое поле (ДОБАВЬТЕ ЭТУ СТРОЧКУ)
setTimeout(() => {
    const editable = document.getElementById('letterContentEditable');
    if (editable) {
        editable.innerHTML = formData.value.letter.content || '';
    }
}, 100);
        
        // Показываем уведомление если используется профиль
        const hasData = user.value.senderProfile && (
            user.value.senderProfile.senderPosition || 
            user.value.senderProfile.senderOrganization || 
            user.value.senderProfile.senderName
        );
        
        if (user.value.senderProfile?.isLocked && hasData) {
            showNotification("✅ Данные отправителя автоматически заполнены из настроек!");
        }
    },

    closeLetterForm: () => {
        if (confirm("Закрыть форму? Несохраненные изменения будут потеряны.")) {
            showLetterForm.value = false;
        }
    },
    
    saveToFolder: async () => {
        // Если мы редактируем существующее письмо, сохраняем сразу без модального окна
        if (isEditingExistingFile.value && currentEditingFile.value) {
            await confirmSaveDirect();
            return;
        }
        
        // Для нового письма показываем модальное окно
        saveFileName.value = formData.value.letter.number 
            ? `Письмо_${formData.value.letter.number.replace(/\//g, '_')}`
            : '';
        
        const modal = new bootstrap.Modal(document.getElementById('folderModal'));
        modal.show();
        
        // Фокусируемся на поле ввода имени после открытия модального окна
        setTimeout(() => {
            const input = document.getElementById('fileNameInput');
            if (input) input.focus();
        }, 300);
    }
};
    }
});

// Глобальный обработчик ошибок
app.config.errorHandler = (err, vm, info) => {
    console.error('Ошибка Vue:', err, info);
};

// Компонент контекстного меню для папок - ИСПРАВЛЕННЫЙ
app.component('folder-context-menu', {
    template: `
        <div class="context-menu" :style="menuStyle" v-if="showMenu" v-click-outside="closeMenu">
            <button class="context-menu-item" @click="createSubFolder">
                <span class="me-2">📁</span>
                Создать подпапку
            </button>
            
            <div class="context-menu-divider"></div>
            
            <button class="context-menu-item danger" @click="deleteFolder">
                <span class="me-2">🗑️</span>
                Удалить папку
            </button>
        </div>
    `,
    props: {
        showMenu: Boolean,
        position: Object,
        folderPath: String
    },
    computed: {
        menuStyle() {
            return {
                left: this.position.x + 'px',
                top: this.position.y + 'px',
                position: 'fixed',
                'z-index': 9999
            };
        }
    },
    methods: {
        createSubFolder() {
            this.$emit('create-folder', this.folderPath);
            this.closeMenu();
        },
        
        deleteFolder() {
            this.$emit('delete-folder', this.folderPath);
            this.closeMenu();
        },
        
        closeMenu() {
            this.$emit('close-menu');
        }
    }
});

// Компонент контекстного меню для файлов - ИСПРАВЛЕННЫЙ
app.component('file-context-menu', {
    template: `
        <div class="context-menu" :style="menuStyle" v-if="showMenu" v-click-outside="closeMenu">
            <button class="context-menu-item" @click="editFile">
                <span class="me-2">✏️</span>
                Редактировать
            </button>
            
            <div class="context-menu-divider"></div>
            
            <button class="context-menu-item danger" @click="deleteFile">
                <span class="me-2">🗑️</span>
                Удалить письмо
            </button>
        </div>
    `,
    props: {
        showMenu: Boolean,
        position: Object,
        file: Object
    },
    computed: {
        menuStyle() {
            return {
                left: this.position.x + 'px',
                top: this.position.y + 'px',
                position: 'fixed',
                'z-index': 9999
            };
        }
    },
    methods: {
        editFile() {
            this.$emit('edit-file', this.file);
            this.closeMenu();
        },
        
        deleteFile() {
            this.$emit('delete-file', this.file);
            this.closeMenu();
        },
        
        closeMenu() {
            this.$emit('close-menu');
        }
    }
});

// Директива для закрытия меню при клике вне его - ИСПРАВЛЕННАЯ
app.directive('click-outside', {
    beforeMount(el, binding) {
        el.clickOutsideEvent = function(event) {
            // Проверяем, что клик был вне элемента и его дочерних элементов
            if (!(el === event.target || el.contains(event.target))) {
                binding.value(event);
            }
        };
        // Используем capture phase чтобы перехватить клик раньше других обработчиков
        document.addEventListener('click', el.clickOutsideEvent, true);
        document.addEventListener('contextmenu', el.clickOutsideEvent, true);
    },
    unmounted(el) {
        document.removeEventListener('click', el.clickOutsideEvent, true);
        document.removeEventListener('contextmenu', el.clickOutsideEvent, true);
    }
});

// Упрощенный компонент папки с контекстным меню - ИСПРАВЛЕННЫЙ
app.component('folder-item', {
    template: `
        <div class="folder-item">
            <div class="d-flex align-items-center position-relative">
                <!-- Кнопка раскрытия/скрытия -->
                <span @click="toggle" class="toggle-icon me-2" style="cursor: pointer; width: 20px; text-align: center;">
                    <span v-if="hasChildren || folder.filesCount > 0">
                        {{ isOpen ? '▼' : '►' }}
                    </span>
                    <span v-else>•</span>
                </span>
                
                <!-- Иконка и название папки -->
                <span @click.stop="selectFolder" class="folder-name d-flex align-items-center" 
                      style="cursor: pointer; flex-grow: 1; padding: 4px 8px; border-radius: 4px;"
                      :class="{ 'selected-folder': isSelected }">
                    
                    <span class="folder-icon me-2">
                        {{ hasFiles ? '📁' : '📂' }}
                    </span>
                    
                    <span class="fw-medium">{{ safeFolderName }}</span>
                    
                    <!-- Бейдж с количеством файлов -->
                    <span v-if="folder.filesCount > 0" class="files-badge ms-2">
                        {{ folder.filesCount }}
                    </span>
                </span>
                
                <!-- Кнопка контекстного меню -->
                <button @click.stop="toggleFolderContextMenu($event)" 
                        class="context-menu-btn ms-2" 
                        title="Действия"
                        style="opacity: 0.4; transition: opacity 0.2s ease;">
                    ⋮
                </button>
            </div>
            
            <!-- Контекстное меню для папки -->
            <folder-context-menu
                v-if="showFolderContextMenu"
                :show-menu="showFolderContextMenu"
                :position="folderContextMenuPosition"
                :folder-path="folder.path"
                @create-folder="handleCreateSubFolder"
                @delete-folder="handleDeleteFolder"
                @close-menu="closeFolderContextMenu">
            </folder-context-menu>
            
            <!-- Вложенные элементы (папки и файлы) -->
            <div v-if="isOpen" class="folder-children ms-4 mt-1">
                <!-- Подпапки -->
                <folder-item
                    v-for="child in folder.children"
                    :key="'folder-' + child.path"
                    :folder="child"
                    :current-path="currentPath"
                    :username="username"
                    @change-folder="$emit('change-folder', $event)"
                    @create-folder="$emit('create-folder', $event)"
                    @delete-folder="$emit('delete-folder', $event)"
                    @load-letter="$emit('load-letter', $event)"
                    @delete-letter="$emit('delete-letter', $event)">
                </folder-item>
                
                <!-- Письма в этой папке -->
                <div v-if="isOpen && folder.files && folder.files.length > 0" class="files-section">
                    <div v-for="file in folder.files" :key="'file-' + file.id" 
                         class="file-item d-flex align-items-center ps-3 py-1 position-relative">
                        <span @click="loadLetter(file)" class="d-flex align-items-center" 
                              style="cursor: pointer; flex-grow: 1; padding: 4px 8px; border-radius: 4px;">
                            <span class="me-2">📄</span>
                            <span class="file-name">{{ file.name }}</span>
                        </span>
                        
                        <!-- Кнопка контекстного меню для файла -->
                        <button @click.stop="toggleFileContextMenu(file, $event)" 
                                class="context-menu-btn ms-2" 
                                title="Действия с письмом"
                                style="opacity: 0.4; transition: opacity 0.2s ease;">
                            ⋮
                        </button>
                    </div>
                </div>
                
                <!-- Сообщение если папка пуста -->
                <div v-if="!hasChildren && (!folder.files || folder.files.length === 0)" class="text-muted ps-3 py-1">
                    <small>Папка пуста</small>
                </div>
            </div>
            
            <!-- Контекстное меню для файла -->
            <file-context-menu
                v-if="showFileContextMenu"
                :show-menu="showFileContextMenu"
                :position="fileContextMenuPosition"
                :file="currentFileContext"
                @edit-file="handleEditFile"
                @delete-file="handleDeleteFile"
                @close-menu="closeFileContextMenu">
            </file-context-menu>
        </div>
    `,
    props: {
        folder: {
            type: Object,
            required: true
        },
        currentPath: {
            type: String,
            default: ''
        },
        username: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
            isOpen: false,
            showFolderContextMenu: false,
            showFileContextMenu: false,
            folderContextMenuPosition: { x: 0, y: 0 },
            fileContextMenuPosition: { x: 0, y: 0 },
            currentFileContext: null
        };
    },
    computed: {
        hasChildren() {
            return this.folder.children && 
                   Array.isArray(this.folder.children) && 
                   this.folder.children.length > 0;
        },
        safeFolderName() {
            return this.folder.name || 'Без имени';
        },
        isSelected() {
            return this.currentPath === this.folder.path;
        },
        hasFiles() {
            return this.folder.filesCount > 0 || (this.folder.files && this.folder.files.length > 0);
        }
    },
    methods: {
        toggle() {
            this.isOpen = !this.isOpen;
            this.closeAllContextMenus();
        },
        
        selectFolder() {
            console.log("📁 Выбрана папка:", this.folder.path);
            this.$emit('change-folder', this.folder.path);
            this.closeAllContextMenus();
        },
        
        loadLetter(file) {
            this.$emit('load-letter', file);
        },
        
        deleteLetter(file) {
            if (confirm(`Удалить письмо "${file.name}"?`)) {
                this.$emit('delete-letter', file);
            }
        },
        
        // Методы для контекстного меню папки
        toggleFolderContextMenu(event) {
            console.log("🟡 Контекстное меню папки вызвано для:", this.folder.name);
            event.stopPropagation();
            event.preventDefault();
            
            // Закрываем другие меню и открываем текущее
            this.closeAllContextMenus();
            this.showFolderContextMenu = true;
            
            // Правильное позиционирование меню
            const rect = event.currentTarget.getBoundingClientRect();
            this.folderContextMenuPosition = {
                x: rect.left,
                y: rect.bottom + 5
            };
        },
        
        handleCreateSubFolder() {
            console.log("📁 Создание подпапки в:", this.folder.path);
            this.$emit('create-folder', this.folder.path);
            this.closeFolderContextMenu();
        },
        
        handleDeleteFolder() {
            console.log("🗑️ Удаление папки:", this.folder.path);
            this.$emit('delete-folder', this.folder.path);
            this.closeFolderContextMenu();
        },
        
        closeFolderContextMenu() {
            this.showFolderContextMenu = false;
        },
        
        // Методы для контекстного меню файла
        toggleFileContextMenu(file, event) {
            console.log("🟡 Контекстное меню файла вызвано для:", file.name);
            event.stopPropagation();
            event.preventDefault();
            
            this.closeAllContextMenus();
            this.currentFileContext = file;
            this.showFileContextMenu = true;
            
            const rect = event.currentTarget.getBoundingClientRect();
            this.fileContextMenuPosition = {
                x: rect.left,
                y: rect.bottom + 5
            };
        },
        
        handleEditFile(file) {
            console.log("✏️ Редактирование файла:", file.name);
            this.loadLetter(file);
            this.closeFileContextMenu();
        },
        
        handleDeleteFile(file) {
            console.log("🗑️ Удаление файла:", file.name);
            this.deleteLetter(file);
            this.closeFileContextMenu();
        },
        
        closeFileContextMenu() {
            this.showFileContextMenu = false;
            this.currentFileContext = null;
        },
        
        closeAllContextMenus() {
            this.closeFolderContextMenu();
            this.closeFileContextMenu();
        }
    },
    mounted() {
        // Автоматически открываем выбранную папку
        if (this.isSelected) {
            this.isOpen = true;
        }
    }
});
// Компонент папки для модального окна выбора пути (письма не кликабельны)
app.component('folder-item-modal', {
    template: `
        <div class="folder-item">
            <div class="d-flex align-items-center position-relative">
                <!-- Кнопка раскрытия/скрытия -->
                <span @click="toggle" class="toggle-icon me-2" style="cursor: pointer; width: 20px; text-align: center;">
                    <span v-if="hasChildren || folder.filesCount > 0">
                        {{ isOpen ? '▼' : '►' }}
                    </span>
                    <span v-else>•</span>
                </span>
                
                <!-- Иконка и название папки -->
                <span @click.stop="selectFolder" class="folder-name d-flex align-items-center" 
                      style="cursor: pointer; flex-grow: 1; padding: 4px 8px; border-radius: 4px;"
                      :class="{ 'selected-folder': isSelected }">
                    
                    <span class="folder-icon me-2">
                        {{ hasFiles ? '📁' : '📂' }}
                    </span>
                    
                    <span class="fw-medium">{{ safeFolderName }}</span>
                    
                    <!-- Бейдж с количеством файлов -->
                    <span v-if="folder.filesCount > 0" class="files-badge ms-2">
                        {{ folder.filesCount }}
                    </span>
                </span>
            </div>
            
            <!-- Вложенные элементы (папки и файлы) -->
            <div v-if="isOpen" class="folder-children ms-4 mt-1">
                <!-- Подпапки -->
                <folder-item-modal
                    v-for="child in folder.children"
                    :key="'folder-modal-' + child.path"
                    :folder="child"
                    :current-path="currentPath"
                    @change-folder="$emit('change-folder', $event)">
                </folder-item-modal>
                
                <!-- Письма в этой папке (НЕ кликабельны в модальном окне) -->
                <div v-if="isOpen && folder.files && folder.files.length > 0" class="files-section">
                    <div v-for="file in folder.files" :key="'file-modal-' + file.id" 
                         class="file-item d-flex align-items-center ps-3 py-1">
                        <span class="d-flex align-items-center text-muted" 
                              style="flex-grow: 1; padding: 4px 8px; border-radius: 4px;"
                              title="В режиме выбора папки письма нельзя открывать">
                            <span class="me-2">📄</span>
                            <span class="file-name" style="opacity: 0.7;">{{ file.name }}</span>
                        </span>
                    </div>
                </div>
                
                <!-- Сообщение если папка пуста -->
                <div v-if="!hasChildren && (!folder.files || folder.files.length === 0)" class="text-muted ps-3 py-1">
                    <small>Папка пуста</small>
                </div>
            </div>
        </div>
    `,
    props: {
        folder: {
            type: Object,
            required: true
        },
        currentPath: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
            isOpen: false
        };
    },
    computed: {
        hasChildren() {
            return this.folder.children && 
                   Array.isArray(this.folder.children) && 
                   this.folder.children.length > 0;
        },
        safeFolderName() {
            return this.folder.name || 'Без имени';
        },
        isSelected() {
            return this.currentPath === this.folder.path;
        },
        hasFiles() {
            return this.folder.filesCount > 0 || (this.folder.files && this.folder.files.length > 0);
        }
    },
    methods: {
        toggle() {
            this.isOpen = !this.isOpen;
        },
        
        selectFolder() {
            console.log("📁 Выбрана папка для сохранения:", this.folder.path);
            this.$emit('change-folder', this.folder.path);
        }
    },
    mounted() {
        // Автоматически открываем выбранную папку
        if (this.isSelected) {
            this.isOpen = true;
        }
    }
});


// Монтируем приложение
app.mount("#app");