// --- CONFIG USER (Hardcoded untuk sementara) ---
const VALID_USER = "admin";
const VALID_PASS = "123";

// --- LOGIN SYSTEM (REVISI ANTI-GAGAL) ---
function handleLogin(e) {
    e.preventDefault(); // Mencegah reload halaman
    
    // Ambil nilai dan hapus spasi tidak sengaja (trim)
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    console.log("Mencoba login dengan:", u, p); // Cek di Console (F12) jika masih gagal

    // Cek Password (Username "admin", Password "123")
    // Kita buat username tidak peduli huruf besar/kecil (toLowerCase)
    if (u.toLowerCase() === VALID_USER && p === VALID_PASS) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', u); // Simpan nama user
        
        Swal.fire({
            icon: 'success',
            title: 'Login Berhasil',
            showConfirmButton: false,
            timer: 1000
        }).then(() => {
            location.reload(); // Refresh halaman untuk masuk
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Username: admin | Password: 123'
        });
    }
}
