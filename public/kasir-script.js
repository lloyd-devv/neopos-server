// --- LOGIC UTAMA ---
const USERS = { "admin": "123", "manager": "9999" };
const MANAGER_PIN = "9999";
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

window.onload = () => {
    // Load Theme & Login State
    const t = localStorage.getItem('theme') || 'dark';
    setTheme(t);
    document.getElementById('themeSelect').value = t;

    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData().then(() => nav('dashboard'));
    }
};

// --- NAVIGATION & SIDEBAR ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    // Toggle class translate untuk efek slide
    if (sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
}

function nav(pageId) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Tampilkan halaman aktif
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active');

    // Tutup sidebar jika di HP
    if(window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }

    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// --- AUTH ---
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(USERS[u] && USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        location.reload();
    } else Swal.fire('Error', 'Login Gagal', 'error');
}
function handleLogout() { sessionStorage.clear(); location.reload(); }

// --- DATA ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        if(!res.ok) throw new Error("Gagal");
        const d = await res.json();
        products = d.products || [];
        history = d.history || [];
        renderProducts();
    } catch(e) { console.error(e); }
}

// --- POS ---
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const cat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase() || 'semua';
    const grid = document.getElementById('grid');
    
    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        if(cat!=='semua' && ((cat==='makanan'&&p.category!=='food')||(cat==='minuman'&&p.category!=='drink')||(cat==='cemilan'&&p.category!=='snack'))) return '';
        
        return `
        <div onclick="addToCart(${p.id})" class="card p-4 cursor-pointer hover:border-[var(--accent)] transition group relative overflow-hidden flex flex-col h-full ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="flex justify-between items-start mb-2">
                <div class="w-10 h-10 rounded-xl bg-[var(--bg-input)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition"><i class="fa-solid fa-utensils"></i></div>
                <span class="text-xs font-bold px-2 py-1 rounded bg-[var(--bg-input)]">${p.stock}</span>
            </div>
            <div class="font-bold text-sm line-clamp-2 min-h-[2.5em]">${p.name}</div>
            <div class="text-[var(--accent)] font-bold text-xs mt-1">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

function setCategory(cat) { /* Sama seperti sebelumnya */ 
    document.querySelectorAll('.cat-pill').forEach(b => { b.classList.remove('active','bg-[var(--accent)]','text-white'); b.classList.add('bg-[var(--bg-card)]'); });
    event.target.classList.add('active','bg-[var(--accent)]','text-white'); event.target.classList.remove('bg-[var(--bg-card)]'); renderProducts();
}

function addToCart(id) { /* Sama seperti sebelumnya */ 
    const p = products.find(i=>i.id===id);
    if(p.stock<=0) return Swal.fire({toast:true,position:'top-end',icon:'warning',title:'Habis',showConfirmButton:false,timer:1000});
    const ex=cart.find(i=>i.id===id); if(ex){if(ex.qty<p.stock)ex.qty++;}else{cart.push({...p,qty:1});} renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    let sub = 0;
    if(!cart.length) list.innerHTML = '<div class="text-center text-xs opacity-50 mt-10">Kosong</div>';
    else {
        list.innerHTML = cart.map((i,idx) => {
            sub += i.price * i.qty;
            return `<div class="flex justify-between items-center bg-[var(--bg-input)] p-3 rounded-xl mb-2"><div class="text-xs"><div class="font-bold">${i.name}</div><div>${i.qty} x ${i.price}</div></div><button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500"><i class="fa-solid fa-trash"></i></button></div>`;
        }).join('');
    }
    const disc = parseInt(document.getElementById('inputDiscount').value)||0;
    const tot = Math.max(0, sub-disc);
    document.getElementById('subtotalDisplay').innerText = 'Rp '+sub.toLocaleString();
    document.getElementById('totalDisplay').innerText = 'Rp '+tot.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return tot;
}

function setPayment(m) { payMethod=m; document.querySelectorAll('.pay-btn').forEach(b=>{b.classList.remove('active','bg-[var(--accent)]','text-white'); if(b.innerText.includes(m)) b.classList.add('active','bg-[var(--accent)]','text-white');});}

async function checkout() { /* Sama seperti sebelumnya */ 
    const tot = renderCart(); if(tot===0 && cart.length===0) return;
    let bayar = tot;
    if(payMethod === 'TUNAI') {
        const {value:u} = await Swal.fire({title:`Total: Rp ${tot.toLocaleString()}`, input:'number', confirmButtonText:'BAYAR'});
        if(!u || parseInt(u)<tot) return Swal.fire('Kurang','','error');
        bayar = parseInt(u);
    }
    const disc = parseInt(document.getElementById('inputDiscount').value)||0;
    const trx = {id:'TRX-'+Date.now(), date:new Date().toISOString(), cashier:sessionStorage.getItem('username'), total:tot, method:payMethod, items:cart, discount:disc};
    
    await fetch('/api/checkout', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(trx)});
    
    // Print logic simplified
    document.getElementById('p-items').innerHTML = cart.map(i=>`<tr><td>${i.name}</td><td align="right">${i.qty}x${i.price}</td></tr>`).join('');
    cart=[]; renderCart(); loadData();
    window.print();
}

function calcDashboard() { /* Sama seperti sebelumnya */ 
    const today=new Date().toDateString(); let inc=0, sld=0, cnt=0;
    const days=[], data=[0,0,0,0,0,0,0]; for(let i=6;i>=0;i--){const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('id',{weekday:'short'}));}
    history.forEach(t=>{
        const d=new Date(t.date); if(d.toDateString()===today){inc+=t.total; cnt++; try{JSON.parse(t.items).forEach(i=>sld+=i.qty);}catch(e){}}
        const diff=Math.floor((new Date()-d)/(86400000)); if(diff>=0 && diff<=6) data[6-diff]+=t.total;
    });
    document.getElementById('dash-income').innerText='Rp '+inc.toLocaleString();
    document.getElementById('dash-sold').innerText=sld;
    document.getElementById('dash-trx').innerText=cnt;
    const ctx = document.getElementById('salesChart'); if(salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {type:'bar', data:{labels:days, datasets:[{label:'Omzet', data:data, backgroundColor:'#3b82f6'}]}});
}

// Helpers
async function delHistory(id) { const {value:p}=await Swal.fire({title:'PIN',input:'password'}); if(p===MANAGER_PIN){await fetch(`/api/history/${id}`,{method:'DELETE'}); loadData().then(renderHistoryTable);} else Swal.fire('Salah','','error'); }
function renderHistoryTable() { document.getElementById('historyTableBody').innerHTML=history.map(t=>`<tr><td class="p-3">${new Date(t.date).toLocaleString()}</td><td class="p-3 text-xs font-mono">${t.id}</td><td class="p-3 text-center">${t.method}</td><td class="p-3 text-right">Rp ${t.total.toLocaleString()}</td><td class="p-3 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''); }
async function addNewProduct() { const n=document.getElementById('newName').value, p=document.getElementById('newPrice').value, s=document.getElementById('newStock').value, c=document.getElementById('newCategory').value; if(n&&p) { await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,price:p,stock:s,category:c})}); loadData().then(renderStockTable); } }
async function delProd(id) { if(confirm('Hapus?')) { await fetch(`/api/products/${id}`,{method:'DELETE'}); loadData().then(renderStockTable); } }
function renderStockTable() { document.getElementById('stockTableBody').innerHTML=products.map(p=>`<tr><td class="p-3">${p.name}</td><td class="p-3 text-xs uppercase">${p.category}</td><td class="p-3">Rp ${p.price.toLocaleString()}</td><td class="p-3 text-center">${p.stock}</td><td class="p-3 text-center"><button onclick="delProd(${p.id})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''); }
