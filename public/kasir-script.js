const USERS = { "admin": "123", "kasir": "1" };
let products = [], history = [], cart = [];

// --- INIT (Jalankan saat web dibuka) ---
window.onload = () => {
    // 1. Load Tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.getElementById('themeSelect').value = savedTheme;

    // 2. Cek Login
    if(sessionStorage.getItem('isLoggedIn')) {
        // SEMBUNYIKAN LOGIN SCREEN
        document.getElementById('login-screen').classList.add('hidden');
        
        // TAMPILKAN MAIN APP (Ini yang kemarin kurang!)
        document.getElementById('main-app').classList.remove('hidden');
        
        // Load Data & Buka Dashboard
        loadData();
        nav('dashboard'); 
    }
};

// --- FUNGSI LOGIN (Update agar refresh otomatis) ---
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    // Cek User & Password
    if(USERS[u] && USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', u);
        
        Swal.fire({
            icon: 'success',
            title: 'Login Berhasil',
            showConfirmButton: false,
            timer: 1000
        }).then(() => {
            location.reload(); // Refresh agar window.onload jalan
        });
    } else {
        Swal.fire('Error', 'Username atau Password Salah', 'error');
    }
}

// ... (Sisa kode ke bawah biarkan saja) ...
