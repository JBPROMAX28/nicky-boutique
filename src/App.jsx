import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Menu, 
  X, 
  LogOut, 
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  Image as ImageIcon,
  Users,
  Lock,
  Settings,
  Save,
  ListPlus,
  Eraser,
  DollarSign,
  ClipboardList,
  Download,
  Upload,
  FileSpreadsheet,
  Calendar,
  Palette,
  FileDown,
  CheckCircle,
  Shield,
  Eye,
  Truck,
  MinusCircle,
  AlertCircle,
  EyeOff,
  Edit,
  Unlock,
  UserCog,
  Sparkles,
  BrainCircuit,
  Lightbulb,
  Barcode,     
  Wallet,      
  Share2,      
  ScanBarcode, 
  Receipt,
  Printer,     
  History      
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  query,
  where,
  setDoc,
  arrayUnion,
  arrayRemove,
  orderBy
} from 'firebase/firestore';

// --- CONFIGURACIÓN FIREBASE ---
// NOTA: Para producción, reemplaza JSON.parse(__firebase_config) con tu objeto de configuración real.
const firebaseConfig = {
  apiKey: "AIzaSyBVb9hUrPnMi2kfWOcQ5BA6lnwnuqXHffQ",
  authDomain: "nicky-boutique-pro.firebaseapp.com",
  projectId: "nicky-boutique-pro",
  storageBucket: "nicky-boutique-pro.firebasestorage.app",
  messagingSenderId: "527411302511",
  appId: "1:527411302511:web:442a7f1f8ac753f0e8bd9a",
  measurementId: "G-BG60P98WWK"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'sucursal-principal-01';
// --- GEMINI API UTILS ---
const callGeminiAPI = async (prompt) => {
  try {
    const apiKey = ""; // La clave se inyecta automáticamente en este entorno. Para producción, usa tu propia API Key.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar respuesta de la IA.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error al conectar con la IA. Por favor intenta más tarde.";
  }
};

// --- SISTEMA DE PERMISOS GRANULARES ---

const PERMISSIONS_LIST = [
  // Dashboard y Finanzas
  { id: 'view_dashboard', label: 'Ver Panel Principal (Dashboard)', group: 'Dashboard' },
  { id: 'view_financials', label: 'Ver Dinero y Ganancias (S/)', group: 'Dashboard' },
  { id: 'manage_expenses', label: 'Gestionar Gastos/Caja Chica', group: 'Dashboard' },
  
  // Ventas (POS)
  { id: 'access_pos', label: 'Acceso a Caja (Vender)', group: 'Ventas' },
  { id: 'change_pos_price', label: 'Modificar Precio en Caja', group: 'Ventas' },
  { id: 'view_sales_history', label: 'Ver Historial de Ventas', group: 'Ventas' }, 
  
  // Inventario
  { id: 'view_inventory', label: 'Ver Lista de Inventario', group: 'Inventario' },
  { id: 'view_costs', label: 'Ver Costos de Compra', group: 'Inventario' },
  { id: 'add_products', label: 'Crear Productos Nuevos', group: 'Inventario' },
  { id: 'edit_products', label: 'Editar Productos Existentes', group: 'Inventario' },
  { id: 'delete_products', label: 'Eliminar Productos', group: 'Inventario' },
  { id: 'adjust_stock', label: 'Ajustar Stock (Mermas)', group: 'Inventario' },
  
  // Reportes
  { id: 'view_reports', label: 'Ver Reportes y Gráficos', group: 'Reportes' },
  { id: 'export_data', label: 'Exportar Excel/CSV', group: 'Reportes' },
  
  // Administración
  { id: 'manage_users', label: 'Gestionar Usuarios', group: 'Admin' },
  { id: 'manage_settings', label: 'Configurar Categorías/Tallas', group: 'Admin' },
];

// Plantillas de Roles (Presets)
const ROLE_PRESETS = {
  admin: { 
    label: 'Administrador (Dueño)', 
    desc: 'Acceso total',
    defaultPermissions: PERMISSIONS_LIST.map(p => p.id) 
  },
  warehouse: { 
    label: 'Almacenero', 
    desc: 'Gestión de stock',
    defaultPermissions: ['view_inventory', 'add_products', 'edit_products', 'adjust_stock']
  },
  seller: { 
    label: 'Vendedor', 
    desc: 'Solo ventas',
    defaultPermissions: ['access_pos', 'view_inventory', 'view_sales_history']
  },
  auditor: { 
    label: 'Auditor', 
    desc: 'Ver reportes',
    defaultPermissions: ['view_dashboard', 'view_inventory', 'view_reports', 'export_data', 'manage_expenses', 'view_sales_history']
  },
  custom: {
    label: 'Personalizado',
    desc: 'Permisos manuales',
    defaultPermissions: []
  }
};

const hasPermission = (user, permissionId) => {
  if (!user) return false;
  if (user.username === 'admin' || user.role === 'admin') return true;
  if (user.customPermissions && Array.isArray(user.customPermissions)) {
    return user.customPermissions.includes(permissionId);
  }
  const roleDef = ROLE_PRESETS[user.role];
  if (roleDef && roleDef.defaultPermissions) {
    return roleDef.defaultPermissions.includes(permissionId);
  }
  return false;
};

// --- FUNCIÓN DE IMPRESIÓN DE TICKETS ---
const printTicket = (sale) => {
  const printWindow = window.open('', '', 'width=300,height=600');
  if (!printWindow) {
    alert("Por favor habilita las ventanas emergentes para imprimir tickets.");
    return;
  }

  const itemsHtml = sale.items.map(item => `
    <div class="item">
      <span>${item.qty} x ${item.name} <span style="font-size:10px">(${item.size})</span></span>
      <span>${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Ticket #${sale.id ? sale.id.slice(0, 6) : 'NEW'}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 100%; max-width: 280px; color: #000; }
          .header { text-align: center; margin-bottom: 10px; }
          .title { font-size: 16px; font-weight: bold; display: block; margin-bottom: 2px;}
          .subtitle { font-size: 10px; color: #555; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
          @media print {
            @page { margin: 0; size: auto; }
            body { margin: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="title">Nicky Boutique</span>
          <span class="subtitle">Moda & Estilo</span><br/>
          <span class="subtitle">${sale.date} - ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span><br/>
          <span class="subtitle">Atendido por: ${sale.seller}</span>
        </div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="total-row">
          <span>TOTAL</span>
          <span>S/ ${sale.total.toFixed(2)}</span>
        </div>
        <div class="footer">
          ¡Gracias por tu preferencia!<br/>
          No se aceptan devoluciones<br/>
          después de 7 días.
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// --- COMPONENTES UI ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-pink-100 text-gray-900 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button", title = "", ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-pink-600 text-white hover:bg-pink-700 active:scale-95 shadow-md shadow-pink-200",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-200",
    ghost: "text-gray-500 hover:bg-gray-100",
    icon: "p-2 bg-gray-100 text-gray-600 hover:bg-gray-200",
    ai: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-md shadow-fuchsia-200"
  };
  
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      title={title}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input 
      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
      {...props}
    />
  </div>
);

const Checkbox = ({ label, checked, onChange }) => (
  <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-pink-600 border-pink-600' : 'border-gray-300 bg-white'}`}>
      {checked && <CheckCircle size={14} className="text-white" />}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    <span className="text-sm text-gray-700 select-none">{label}</span>
  </label>
);

const DynamicSelect = ({ label, options = [], value, onChange, onAdd, placeholder, disabled = false }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <div className="flex gap-2">
      <select 
        value={value} 
        onChange={onChange}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
      >
        <option value="">{placeholder || "-- Seleccionar --"}</option>
        {(options || []).map((opt, idx) => (
          <option key={idx} value={opt}>{opt}</option>
        ))}
      </select>
      <button 
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Agregar nueva opción"
      >
        <Plus size={20} />
      </button>
    </div>
  </div>
);

const ActionModal = ({ isOpen, onClose, onConfirm, title, message, type = 'danger', inputType = null }) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(inputValue);
    } catch (error) {
      alert("Ocurrió un error: " + (error.message || "Error desconocido"));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <Card className="w-full max-w-sm shadow-2xl relative overflow-hidden">
        <div className={`p-4 ${type === 'danger' ? 'bg-red-50' : 'bg-blue-50'} border-b ${type === 'danger' ? 'border-red-100' : 'border-blue-100'} flex items-center gap-3`}>
          {type === 'danger' ? <AlertCircle className="text-red-600"/> : <CheckCircle className="text-blue-600"/>}
          <h3 className={`font-bold ${type === 'danger' ? 'text-red-800' : 'text-blue-800'}`}>{title}</h3>
        </div>
        
        <div className="p-6">
          <p className="text-gray-600 mb-4">{message}</p>
          
          {inputType === 'number' && (
            <div className="mb-4">
              <Input 
                type="number" 
                placeholder="Cantidad..." 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                autoFocus
                disabled={loading}
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Cancelar</Button>
            <Button 
              onClick={handleConfirm} 
              variant={type === 'danger' ? 'danger' : 'primary'}
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// --- UTILIDADES ---
const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  const separator = ',';
  const keys = Object.keys(data[0]);
  const csvContent = keys.join(separator) + '\n' + data.map(row => keys.map(k => { let cell = row[k] === null || row[k] === undefined ? '' : row[k]; cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""'); if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`; return cell; }).join(separator)).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]); // State for Expenses
  const [cart, setCart] = useState([]);
  const [configOptions, setConfigOptions] = useState({ categories: [], sizes: [], colors: [], category_names: {} });

  // Estados para modales
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalConfig, setAddModalConfig] = useState({ type: '', categoryContext: '' });
  const [newItemValue, setNewItemValue] = useState('');
  
  // Estado para editar perfil
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', username: '', password: '' });

  const [actionModal, setActionModal] = useState({ 
    isOpen: false, 
    type: 'danger', 
    title: '', 
    message: '', 
    inputType: null,
    onConfirm: () => {} 
  });

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        if (error.code === 'auth/network-request-failed') {
          setTimeout(async () => {
            if (!mounted) return;
            try {
              if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                 await signInWithCustomToken(auth, __initial_auth_token);
              } else {
                 await signInAnonymously(auth);
              }
            } catch (retryErr) {
              setLoading(false);
            }
          }, 2000);
        } else {
          if (mounted) setLoading(false);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (mounted) { setFirebaseUser(u); setLoading(false); }
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const checkUsers = async () => {
      try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
            username: 'admin', password: 'admin123', name: 'Admin', role: 'admin', createdAt: serverTimestamp()
          });
        }
      } catch (err) {}
    };
    checkUsers();

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config_doc');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfigOptions(prev => ({ ...prev, ...docSnap.data() }));
      } else {
        setDoc(configRef, {
          categories: ['Damas', 'Caballeros', 'Niños'],
          sizes: ['S', 'M', 'L', 'XL'],
          colors: ['Negro', 'Blanco', 'Rojo'],
          category_names: { 'Damas': ['Blusa'], 'Caballeros': ['Camisa'] }
        }, { merge: true });
      }
    });
    return () => unsubConfig();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !appUser) return;
    
    // Products Listener
    const prodQuery = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubProd = onSnapshot(prodQuery, (snapshot) => setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))));
    
    // Sales Listener
    const salesQuery = collection(db, 'artifacts', appId, 'public', 'data', 'sales');
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const s = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      s.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setSales(s);
    });

    // Expenses Listener
    const expensesQuery = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const e = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      e.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setExpenses(e);
    });

    return () => { unsubProd(); unsubSales(); unsubExpenses(); };
  }, [firebaseUser, appUser]);

  const openAddModal = (type, categoryContext = null) => {
    setAddModalConfig({ type, categoryContext });
    setNewItemValue('');
    setAddModalOpen(true);
  };

  const handleSaveNewOption = async (e) => {
    e.preventDefault();
    if (!newItemValue.trim()) return;
    const val = newItemValue.trim();
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config_doc');
    try {
      if (addModalConfig.type === 'category') await updateDoc(configRef, { categories: arrayUnion(val) });
      else if (addModalConfig.type === 'size') await updateDoc(configRef, { sizes: arrayUnion(val) });
      else if (addModalConfig.type === 'color') await updateDoc(configRef, { colors: arrayUnion(val) });
      else if (addModalConfig.type === 'name') {
        const cat = addModalConfig.categoryContext;
        if (cat) await updateDoc(configRef, { [`category_names.${cat}`]: arrayUnion(val) });
      }
      setAddModalOpen(false);
    } catch (err) {
      if (addModalConfig.type === 'name') {
         const cat = addModalConfig.categoryContext;
         const currentNames = configOptions.category_names?.[cat] || [];
         await setDoc(configRef, { category_names: { ...configOptions.category_names, [cat]: [...currentNames, val] } }, { merge: true });
         setAddModalOpen(false);
      }
    }
  };

  // --- GESTIÓN DE PERFIL PROPIO ---
  const openProfileModal = () => {
    setProfileData({
      name: appUser.name,
      username: appUser.username,
      password: appUser.password || ''
    });
    setProfileModalOpen(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!appUser?.id) return;

    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', appUser.id);
      await updateDoc(userRef, {
        name: profileData.name,
        username: profileData.username,
        password: profileData.password
      });
      setAppUser(prev => ({ ...prev, name: profileData.name, username: profileData.username, password: profileData.password }));
      alert("Perfil actualizado correctamente");
      setProfileModalOpen(false);
    } catch (err) {
      alert("Error al actualizar perfil");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('username', '==', username), where('password', '==', password));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setAppUser(userData);
      
      if(hasPermission(userData, 'view_dashboard')) setView('dashboard');
      else if(hasPermission(userData, 'access_pos')) setView('pos');
      else if(hasPermission(userData, 'add_products')) setView('add_inventory');
      else setView('stock_list');
    } else {
      alert("Credenciales incorrectas");
    }
  };
  const handleLogout = () => { setAppUser(null); setView('login'); setCart([]); };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, originalPrice: product.price, qty: 1 }];
    });
  };
  const updateCartQty = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.qty + delta);
        const product = products.find(p => p.id === productId);
        if (product && newQty > product.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };
  const updateCartPrice = (productId, newPrice) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, price: newPrice === '' ? '' : Number(newPrice) };
      }
      return item;
    }));
  };
  const processSale = async () => {
    if (cart.length === 0) return;
    if (cart.some(item => item.price === '')) { alert("Precio inválido"); return; }
    const total = cart.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
    const saleData = {
      items: cart, total, seller: appUser.name, timestamp: serverTimestamp(), date: new Date().toLocaleDateString()
    };
    
    // Guardar en DB
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), saleData);
    
    // Actualizar Stock
    for (const item of cart) {
      const productRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', item.id);
      await updateDoc(productRef, { stock: Math.max(0, products.find(p => p.id === item.id).stock - item.qty) });
    }
    setCart([]);
    
    // Ofrecer impresión
    if(window.confirm("Venta procesada. ¿Imprimir Ticket?")) {
      printTicket({ ...saleData, id: docRef.id });
    }
  };

  // --- VISTAS ---

  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center bg-pink-50 p-4">
      <Card className="w-full max-w-md p-8 animate-in zoom-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-pink-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nicky Boutique</h1>
          <p className="text-gray-500">Sistema de Gestión</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input name="username" label="Usuario" placeholder="admin" required />
          <Input name="password" label="Contraseña" type="password" required />
          <Button type="submit" className="w-full py-3">Ingresar</Button>
        </form>
        {/* BOTÓN CATÁLOGO PÚBLICO EN LOGIN */}
        <div className="mt-6 pt-6 border-t border-gray-100">
           <Button variant="secondary" onClick={() => setView('public_catalog')} className="w-full bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100">
             <Share2 size={18} /> Ver Catálogo Digital (Cliente)
           </Button>
        </div>
      </Card>
    </div>
  );

  const CatalogView = () => {
    // Vista Pública Simplificada
    const [catFilter, setCatFilter] = useState('Todas');
    const [search, setSearch] = useState('');
    
    const cats = ['Todas', ...(configOptions.categories || [])];
    const filtered = products.filter(p => 
      p.stock > 0 &&
      (catFilter === 'Todas' || p.category === catFilter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col animate-in fade-in">
        <header className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
             <div>
               <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Nicky Boutique</h1>
               <p className="text-xs text-gray-400">Catálogo Digital</p>
             </div>
             {!appUser && <Button variant="ghost" onClick={() => setView('login')} className="text-sm">Soy Admin</Button>}
             {appUser && <Button variant="secondary" onClick={() => setView('dashboard')}>Volver al Sistema</Button>}
          </div>
          <div className="max-w-7xl mx-auto px-4 pb-4 overflow-x-auto flex gap-2 scrollbar-hide">
            {cats.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${catFilter === c ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                {c}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto p-4 w-full">
           <div className="mb-6 relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
             <input type="text" placeholder="¿Qué estás buscando hoy?" className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-pink-200 text-gray-700" value={search} onChange={e => setSearch(e.target.value)}/>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
             {filtered.map(p => (
               <div key={p.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                 <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                    {p.image ? <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={32}/></div>}
                    {p.stock < 3 && <span className="absolute bottom-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">¡Quedan pocos!</span>}
                 </div>
                 <div className="p-3">
                   <h3 className="font-bold text-gray-800 text-sm truncate">{p.name}</h3>
                   <div className="flex justify-between items-end mt-1">
                     <div>
                       <p className="text-xs text-gray-500">{p.category}</p>
                       <p className="text-xs text-gray-500">{p.size} {p.color ? `• ${p.color}` : ''}</p>
                     </div>
                     <span className="font-bold text-pink-600">S/ {p.price}</span>
                   </div>
                 </div>
               </div>
             ))}
           </div>
           {filtered.length === 0 && <div className="text-center py-20 text-gray-400">No encontramos productos con esa búsqueda 😢</div>}
        </main>
      </div>
    );
  };

  const ExpensesView = () => {
    if (!hasPermission(appUser, 'manage_expenses')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;

    const [newExpense, setNewExpense] = useState({ desc: '', amount: '', category: 'Servicios' });
    const expCategories = ['Servicios', 'Personal', 'Mercadería', 'Movilidad', 'Alimentación', 'Otros'];

    const handleAddExpense = async (e) => {
      e.preventDefault();
      if (!newExpense.desc || !newExpense.amount) return;
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
          ...newExpense,
          amount: parseFloat(newExpense.amount),
          user: appUser.name,
          date: new Date().toLocaleDateString(),
          timestamp: serverTimestamp()
        });
        setNewExpense({ desc: '', amount: '', category: 'Servicios' });
      } catch (err) { alert("Error guardando gasto"); }
    };

    const handleDeleteExpense = async (id) => {
      if(window.confirm("¿Eliminar este registro?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Control de Caja Chica y Gastos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-1">
             <Card className="p-6">
               <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Wallet size={20}/> Registrar Salida</h3>
               <form onSubmit={handleAddExpense}>
                 <Input label="Descripción" placeholder="Ej. Pago Luz del Mes" value={newExpense.desc} onChange={e => setNewExpense({...newExpense, desc: e.target.value})} required />
                 <Input label="Monto (S/)" type="number" step="0.10" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required />
                 <div className="mb-4">
                   <label className="text-sm font-medium text-gray-700 block mb-1">Categoría</label>
                   <select className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                     {expCategories.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
                 <Button type="submit" className="w-full">Registrar Gasto</Button>
               </form>
             </Card>
           </div>
           
           <div className="md:col-span-2">
             <Card className="p-0 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 flex justify-between">
                 <span>Historial de Gastos</span>
                 <span className="text-red-600">Total: S/ {expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(2)}</span>
               </div>
               <div className="max-h-[500px] overflow-y-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-white text-gray-500 text-xs sticky top-0 shadow-sm">
                     <tr><th className="p-3">Fecha</th><th className="p-3">Descripción</th><th className="p-3">Cat.</th><th className="p-3">Monto</th><th className="p-3"></th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {expenses.map(ex => (
                       <tr key={ex.id} className="hover:bg-gray-50">
                         <td className="p-3 text-gray-500 text-xs">{ex.date}</td>
                         <td className="p-3 font-medium">{ex.desc}</td>
                         <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">{ex.category}</span></td>
                         <td className="p-3 text-red-600 font-bold">- S/ {ex.amount}</td>
                         <td className="p-3 text-right"><button onClick={() => handleDeleteExpense(ex.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                       </tr>
                     ))}
                     {expenses.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-400">Sin gastos registrados</td></tr>}
                   </tbody>
                 </table>
               </div>
             </Card>
           </div>
        </div>
      </div>
    );
  };

  const SalesHistoryView = () => {
    if (!hasPermission(appUser, 'view_sales_history')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;
    
    const [searchReceipt, setSearchReceipt] = useState('');
    
    const filteredSales = sales.filter(s => 
      (s.id && s.id.toLowerCase().includes(searchReceipt.toLowerCase())) ||
      (s.seller && s.seller.toLowerCase().includes(searchReceipt.toLowerCase()))
    );

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Historial de Transacciones</h2>
        
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex gap-4 items-center bg-gray-50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
              <input 
                type="text" 
                placeholder="Buscar por ID de Ticket o Vendedor..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
                value={searchReceipt}
                onChange={e => setSearchReceipt(e.target.value)}
              />
            </div>
            <div className="text-xs font-bold text-gray-500 bg-white px-3 py-2 rounded border">
              Total Ventas: {filteredSales.length}
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 text-xs sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="p-4">Ticket ID</th>
                  <th className="p-4">Fecha/Hora</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4">Total</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-xs text-gray-500">#{sale.id ? sale.id.slice(0, 8) : '---'}</td>
                    <td className="p-4 text-gray-600">
                      <div>{sale.date}</div>
                      <div className="text-xs text-gray-400">{sale.timestamp ? new Date(sale.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {sale.items?.map((i, idx) => (
                          <span key={idx} className="text-xs text-gray-700">
                            {i.qty}x {i.name} <span className="text-gray-400">({i.size})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{sale.seller}</td>
                    <td className="p-4 font-bold text-gray-900">S/ {sale.total.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => printTicket(sale)} 
                        className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        title="Reimprimir Ticket"
                      >
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-gray-400">
                      No se encontraron ventas recientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  // ... (UsersView, ReportsView sin cambios mayores)

  const UsersView = () => {
    if (!hasPermission(appUser, 'manage_users')) return <div className="p-8 text-center text-gray-400">Acceso Restringido</div>;
    
    const [usersList, setUsersList] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    
    // Estado para el formulario de nuevo usuario
    const [newUserForm, setNewUserForm] = useState({ name: '', username: '', password: '', role: 'seller' });
    const [selectedPermissions, setSelectedPermissions] = useState(ROLE_PRESETS['seller'].defaultPermissions);

    useEffect(() => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      const unsub = onSnapshot(q, (snap) => setUsersList(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
      return () => unsub();
    }, []);

    // Cuando cambia el rol, actualizar los permisos por defecto
    const handleRoleChange = (e) => {
      const newRole = e.target.value;
      setNewUserForm({ ...newUserForm, role: newRole });
      if (ROLE_PRESETS[newRole]) {
        setSelectedPermissions(ROLE_PRESETS[newRole].defaultPermissions);
      }
    };

    const togglePermission = (permId) => {
      setSelectedPermissions(prev => 
        prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
      );
    };

    const handleCreateUser = async (e) => {
      e.preventDefault();
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
          ...newUserForm,
          customPermissions: selectedPermissions,
          createdAt: serverTimestamp()
        });
        setIsCreating(false);
        setNewUserForm({ name: '', username: '', password: '', role: 'seller' });
      } catch (err) { alert("Error creando usuario"); }
    };

    const handleDeleteUser = (id) => {
      setActionModal({
        isOpen: true,
        type: 'danger',
        title: 'Eliminar Usuario',
        message: '¿Estás seguro de eliminar este usuario?',
        onConfirm: async () => {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', String(id)));
          setActionModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    };

    // Agrupar permisos para mostrar ordenado
    const groupedPermissions = PERMISSIONS_LIST.reduce((acc, perm) => {
      if (!acc[perm.group]) acc[perm.group] = [];
      acc[perm.group].push(perm);
      return acc;
    }, {});

    return (
      <div className="space-y-6 animate-in fade-in pb-12">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Gestión de Personal</h2><Button onClick={() => setIsCreating(true)}><Plus size={20}/> Nuevo Usuario</Button></div>
        
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <Card className="w-full max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 bg-pink-50 flex justify-between items-center sticky top-0">
                <h3 className="font-bold text-xl text-pink-800 flex items-center gap-2"><Users size={24}/> Crear Nuevo Perfil</h3>
                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <form id="userForm" onSubmit={handleCreateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-700 border-b pb-2">1. Datos Básicos</h4>
                      <Input label="Nombre Completo" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} required />
                      <Input label="Usuario (Login)" value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})} required />
                      <Input label="Contraseña" type="password" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} required />
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Rol Base (Plantilla)</label>
                        <select value={newUserForm.role} onChange={handleRoleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 bg-white text-gray-900">
                          {Object.entries(ROLE_PRESETS).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{ROLE_PRESETS[newUserForm.role]?.desc}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-700 border-b pb-2 flex items-center justify-between">
                        2. Permisos y Funciones
                        <span className="text-xs font-normal bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">{selectedPermissions.length} activos</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(groupedPermissions).map(([group, perms]) => (
                          <div key={group} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <h5 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2">{group}</h5>
                            <div className="space-y-1">
                              {perms.map(perm => (
                                <Checkbox 
                                  key={perm.id} 
                                  label={perm.label} 
                                  checked={selectedPermissions.includes(perm.id)} 
                                  onChange={() => togglePermission(perm.id)} 
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                <Button variant="secondary" onClick={() => setIsCreating(false)}>Cancelar</Button>
                {/* CORRECCIÓN: El atributo form="userForm" ahora funciona gracias al fix en Button */}
                <Button type="submit" form="userForm" className="bg-gradient-to-r from-pink-600 to-purple-600 border-none shadow-lg">Guardar Usuario</Button>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usersList.map(u => { 
            const preset = ROLE_PRESETS[u.role] || ROLE_PRESETS.custom;
            const permCount = u.customPermissions?.length || preset.defaultPermissions?.length || 0;
            return (
              <Card key={u.id} className="p-4 relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 font-bold text-xl`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pink-50 text-pink-600 border border-pink-100">
                        {preset.label}
                      </span>
                    </div>
                  </div>
                  {u.username !== 'admin' && (
                    <button onClick={() => handleDeleteUser(u.id)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Unlock size={12}/> {permCount} funciones habilitadas
                  </div>
                  {u.role === 'admin' && <Shield size={14} className="text-purple-500"/>}
                </div>
              </Card>
            ); 
          })}
        </div>
      </div>
    );
  };

  const ReportsView = () => {
    if (!hasPermission(appUser, 'view_reports')) return <div className="text-center p-10 text-gray-400">Acceso restringido a reportes</div>;
    
    const [isRestoring, setIsRestoring] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [previewData, setPreviewData] = useState([]);
    
    const canExport = hasPermission(appUser, 'export_data');
    const canRestore = hasPermission(appUser, 'add_products'); // Reutilizamos este permiso para carga masiva

    const handleExportInventory = () => {
      const dataToExport = products.map(p => ({ CATEGORIA: p.category, NOMBRE: p.name, TALLA: p.size, COLOR: p.color || '', COSTO: p.cost || 0, PRECIO_VENTA: p.price, STOCK: p.stock, IMAGEN: p.image || '' }));
      exportToCSV(dataToExport, `Inventario_Nicky.csv`);
    };
    const handleExportSales = () => {
      let filteredSales = sales;
      if (startDate) { const [y, m, d] = startDate.split('-').map(Number); const start = new Date(y, m - 1, d); filteredSales = filteredSales.filter(s => { if (!s.timestamp) return true; return new Date(s.timestamp.seconds * 1000) >= start; }); }
      if (endDate) { const [y, m, d] = endDate.split('-').map(Number); const end = new Date(y, m - 1, d, 23, 59, 59); filteredSales = filteredSales.filter(s => { if (!s.timestamp) return true; return new Date(s.timestamp.seconds * 1000) <= end; }); }
      if (filteredSales.length === 0) { alert("No hay ventas en el rango."); return; }
      const dataToExport = filteredSales.map(s => ({ FECHA: s.date, VENDEDOR: s.seller, TOTAL: s.total, GANANCIA_ESTIMADA: (s.total - (s.items?.reduce((acc, i) => acc + ((i.cost || 0) * i.qty), 0) || 0)), DETALLE: s.items?.map(i => `${i.qty}x ${i.name} (${i.size} ${i.color || ''})`).join(' | ') || '' }));
      exportToCSV(dataToExport, `Ventas.csv`);
    };
    
    // ... (Logica de carga masiva igual)
    const handleDownloadTemplate = () => { const template = [{ CATEGORIA: "Damas", NOMBRE: "Blusa Seda", TALLA: "M", COLOR: "Rojo", COSTO: 30, PRECIO_VENTA: 50, STOCK: 10 }]; exportToCSV(template, "PLANTILLA_CARGA_MASIVA.csv"); };
    const handleFileSelect = (event) => {
      const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result; if (!text || text.trim().length === 0) throw new Error("Archivo vacío");
          const lines = text.split(/\r\n|\n|\r/); if (lines.length < 2) throw new Error("Sin datos");
          const headerLine = lines[0]; const separator = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';
          const headers = headerLine.split(separator).map(h => h.replace(/^"|"$/g, '').trim().toUpperCase());
          const idx = { category: headers.indexOf('CATEGORIA'), name: headers.indexOf('NOMBRE'), size: headers.indexOf('TALLA'), color: headers.indexOf('COLOR'), cost: headers.indexOf('COSTO'), price: headers.indexOf('PRECIO_VENTA'), stock: headers.indexOf('STOCK'), image: headers.indexOf('IMAGEN') };
          if (idx.name === -1 || idx.price === -1) throw new Error("Faltan columnas obligatorias");
          const parsedData = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim(); if (!line) continue;
            let cols = separator === ';' ? line.split(';') : (line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(','));
            cols = cols.map(c => c ? c.replace(/^"|"$/g, '').trim() : '');
            if (cols.length > idx.name) { parsedData.push({ category: cols[idx.category] || 'General', name: cols[idx.name], size: cols[idx.size] || 'U', color: cols[idx.color] || '', cost: Number(cols[idx.cost]) || 0, price: Number(cols[idx.price]) || 0, stock: Number(cols[idx.stock]) || 0, image: cols[idx.image] || '' }); }
          }
          setPreviewData(parsedData);
        } catch (error) { alert(`Error: ${error.message}`); } finally { event.target.value = ''; }
      }; reader.readAsText(file);
    };
    const confirmRestore = async () => {
      if (previewData.length === 0) return; setIsRestoring(true);
      try { const promises = previewData.map(item => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), { ...item, createdAt: serverTimestamp() })); await Promise.all(promises); alert(`✅ ${previewData.length} productos cargados.`); setPreviewData([]); } catch (err) { alert("Error al guardar."); } finally { setIsRestoring(false); }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Reportes y Respaldos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 relative overflow-hidden">
            {!canExport && <div className="absolute inset-0 bg-white/80 backdrop-blur z-10 flex items-center justify-center text-gray-400 font-bold"><Lock size={20} className="mr-2"/> Sin Permiso para Exportar</div>}
            <h3 className="font-bold text-lg text-pink-800 mb-4 flex items-center gap-2"><Download size={24}/> Exportar Datos</h3><div className="grid grid-cols-2 gap-4 mb-4"><Input type="date" label="Desde" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Input type="date" label="Hasta" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div><div className="space-y-3"><Button onClick={handleExportSales} variant="secondary" className="w-full justify-start h-12"><DollarSign size={20} className="mr-2"/> Descargar Ventas</Button><Button onClick={handleExportInventory} variant="secondary" className="w-full justify-start h-12"><FileSpreadsheet size={20} className="mr-2"/> Descargar Inventario</Button></div>
          </Card>
          
          <Card className="p-6 border-2 border-dashed border-gray-300 relative overflow-hidden">
            {!canRestore && <div className="absolute inset-0 bg-white/80 backdrop-blur z-10 flex items-center justify-center text-gray-400 font-bold"><Lock size={20} className="mr-2"/> Sin Permiso de Carga</div>}
            <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center gap-2"><Upload size={24}/> Carga Masiva</h3><Button onClick={handleDownloadTemplate} className="w-full mb-4 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none"><FileDown size={14} className="mr-2"/> Descargar Plantilla</Button><div className="relative mb-4"><input type="file" accept=".csv" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/><Button className="w-full h-12 bg-blue-600 hover:bg-blue-700"><Upload size={20} className="mr-2"/> Seleccionar Archivo CSV</Button></div>{previewData.length > 0 && (<div className="animate-in slide-in-from-top-4"><div className="bg-gray-50 border p-3 mb-4 max-h-48 overflow-y-auto"><table className="w-full text-xs"><thead><tr><th>Prod.</th><th>Precio</th></tr></thead><tbody>{previewData.map((i,idx)=><tr key={idx}><td>{i.name}</td><td>S/{i.price}</td></tr>)}</tbody></table></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setPreviewData([])} className="flex-1">Cancelar</Button><Button onClick={confirmRestore} disabled={isRestoring} className="flex-1 bg-green-600">{isRestoring ? '...' : 'Confirmar'}</Button></div></div>)}
          </Card>
        </div>
      </div>
    );
  };

  const AddInventoryView = () => {
    if (!hasPermission(appUser, 'add_products')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;
    const [batchList, setBatchList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ category: '', name: '', size: '', color: '', cost: '', price: '', stock: '', image: '', description: '', barcode: '' });
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSelectChange = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });
    const handleCategoryChange = (e) => setFormData({ ...formData, category: e.target.value, name: '' });
    const clearForm = () => setFormData({ category: '', name: '', size: '', color: '', cost: '', price: '', stock: '', image: '', description: '', barcode: '' });
    
    const addToBatch = () => {
      if (!formData.category || !formData.name || !formData.price || !formData.stock) return alert("Faltan datos");
      setBatchList(prev => [...prev, { id: Date.now(), ...formData }]);
      setFormData(prev => ({ ...prev, size: '', color: '', stock: '', description: '', barcode: '' })); 
    };
    
    const removeFromBatch = (id) => setBatchList(batchList.filter(i => i.id !== id));
    
    const saveBatchToDB = async () => {
      if (batchList.length === 0) return;
      setIsSaving(true);
      try {
        const promises = batchList.map(async (item) => {
          const existing = products.find(p => p.category === item.category && p.name === item.name && p.size === item.size && p.color === item.color);
          if (existing) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', existing.id), {
              stock: Number(existing.stock) + Number(item.stock), price: Number(item.price), cost: Number(item.cost || existing.cost || 0), barcode: item.barcode || existing.barcode
            });
          } else {
            const { id: tempId, ...cleanItem } = item;
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), { ...cleanItem, price: Number(item.price), cost: Number(item.cost||0), stock: Number(item.stock), createdAt: serverTimestamp() });
          }
        });
        await Promise.all(promises);
        setBatchList([]); clearForm(); alert("Inventario actualizado");
      } catch (err) { alert("Error"); } finally { setIsSaving(false); }
    };

    const handleGenerateDescription = async () => {
      if (!formData.category || !formData.name) return alert("Selecciona al menos Categoría y Nombre.");
      setIsGeneratingDesc(true);
      const prompt = `Escribe una descripción de producto corta, atractiva y profesional para una boutique de ropa. 
      Datos del producto:
      - Categoría: ${formData.category}
      - Nombre: ${formData.name}
      - Color: ${formData.color || 'No especificado'}
      - Talla: ${formData.size || 'No especificado'}
      La descripción debe ser ideal para vender el producto, máximo 30 palabras.`;
      
      const text = await callGeminiAPI(prompt);
      setFormData(prev => ({ ...prev, description: text }));
      setIsGeneratingDesc(false);
    };

    const availableNames = formData.category ? (configOptions.category_names?.[formData.category] || []) : [];
    const canConfigure = hasPermission(appUser, 'manage_settings');

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Agregar Inventario</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Plus size={20} className="text-pink-600"/> Nueva Prenda</h3><button onClick={clearForm}><Eraser size={20}/></button></div>
            
            {/* Campo Barcode */}
            <div className="mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
               <div className="flex items-center gap-2 mb-1">
                 <Barcode size={16} className="text-gray-500" />
                 <label className="text-xs font-bold text-gray-700 uppercase">Código de Barras (Opcional)</label>
               </div>
               <input 
                 className="w-full bg-white px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                 placeholder="Escanea aquí el código..."
                 value={formData.barcode}
                 onChange={e => setFormData({...formData, barcode: e.target.value})}
                 onKeyDown={e => { if(e.key === 'Enter') e.preventDefault(); }} 
               />
               <p className="text-[10px] text-gray-400 mt-1">Usa tu lector USB o escribe manualmente.</p>
            </div>

            <div className="p-3 bg-pink-50 rounded-xl mb-4 border border-pink-100"><DynamicSelect label="1. Categoría" options={configOptions.categories} value={formData.category} onChange={handleCategoryChange} onAdd={() => openAddModal('category')} placeholder="Seleccionar..." disabled={!canConfigure}/></div>
            <div className={`transition-opacity ${!formData.category ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <DynamicSelect label="Nombre" options={availableNames} value={formData.name} onChange={handleSelectChange('name')} onAdd={() => openAddModal('name', formData.category)} placeholder="Seleccionar..." disabled={!canConfigure}/>
              <div className="grid grid-cols-2 gap-3"><DynamicSelect label="Talla" options={configOptions.sizes} value={formData.size} onChange={handleSelectChange('size')} onAdd={() => openAddModal('size')} placeholder="-" disabled={!canConfigure}/><DynamicSelect label="Color" options={configOptions.colors} value={formData.color} onChange={handleSelectChange('color')} onAdd={() => openAddModal('color')} placeholder="-" disabled={!canConfigure}/></div>
              
              {/* AI Description Generator */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Descripción de Venta</label>
                  <button 
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc}
                    className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-1 rounded flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                  >
                    {isGeneratingDesc ? <span className="animate-spin">✨</span> : <Sparkles size={12}/>} 
                    {isGeneratingDesc ? "Generando..." : "Generar con IA"}
                  </button>
                </div>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange}
                  placeholder="Descripción autogenerada o manual..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 text-sm h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3"><Input name="stock" label="Stock" type="number" value={formData.stock} onChange={handleChange}/><Input name="cost" label="Costo" type="number" value={formData.cost} onChange={handleChange}/></div>
              <Input name="price" label="Precio Venta" type="number" value={formData.price} onChange={handleChange}/><Input name="image" label="Imagen URL" value={formData.image} onChange={handleChange}/>
              <Button onClick={addToBatch} className="w-full mt-4 py-3">AGREGAR A LISTA</Button>
            </div>
            {!canConfigure && <p className="text-xs text-orange-500 mt-2 text-center">Nota: No tienes permiso para crear nuevas categorías/tallas.</p>}
          </Card>
          <div className="space-y-4">
            <Card className="p-4 border-2 border-pink-400 bg-pink-50 shadow-xl h-full flex flex-col">
              <h3 className="font-bold text-pink-800 mb-3">📦 Lista por Guardar ({batchList.length})</h3>
              <div className="flex-1 bg-white rounded border overflow-y-auto min-h-[200px] mb-4">
                {batchList.length===0 ? <div className="p-8 text-center text-gray-400 text-sm">Vacío</div> : <table className="w-full text-sm text-left"><thead className="bg-pink-100 text-pink-700 text-xs"><tr><th className="p-2">Prod.</th><th className="p-2">Detalle</th><th className="p-2">Stock</th><th></th></tr></thead><tbody>{batchList.map(i=><tr key={i.id} className="hover:bg-pink-50/50"><td className="p-2"><div><span className="font-bold">{i.name}</span><br/><span className="text-[10px] text-gray-500 line-clamp-1">{i.description}</span></div></td><td className="p-2 text-xs">{i.size} {i.color}</td><td className="p-2">{i.stock}</td><td><button onClick={()=>removeFromBatch(i.id)} className="text-red-500"><X size={16}/></button></td></tr>)}</tbody></table>}
              </div>
              <Button onClick={saveBatchToDB} disabled={isSaving || batchList.length===0} className="w-full py-3 bg-green-600 hover:bg-green-700">{isSaving ? "Guardando..." : "REGISTRAR TODO"}</Button>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const StockView = () => {
    if (!hasPermission(appUser, 'view_inventory')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;
    
    const canEdit = hasPermission(appUser, 'edit_products') || hasPermission(appUser, 'delete_products');
    const canDelete = hasPermission(appUser, 'delete_products');
    const canMerma = hasPermission(appUser, 'adjust_stock');
    const showCost = hasPermission(appUser, 'view_costs');
    const showFinancials = hasPermission(appUser, 'view_financials');

    const [expandedProducts, setExpandedProducts] = useState({});

    const clickDeleteProduct = (id) => {
      setActionModal({
        isOpen: true,
        type: 'danger',
        title: 'Eliminar Producto',
        message: '¿Estás seguro de eliminar este producto del inventario permanentemente?',
        onConfirm: async () => {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', String(id)));
          setActionModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    };

    const clickDiscountStock = (product) => {
      setActionModal({
        isOpen: true,
        type: 'danger',
        title: 'Descontar Stock (Merma)',
        message: `¿Cuántas unidades de "${product.name} - ${product.size}" deseas dar de baja?`,
        inputType: 'number',
        onConfirm: async (inputValue) => {
          const qty = parseInt(inputValue);
          if (isNaN(qty) || qty <= 0) { alert("Número inválido"); return; }
          const currentStock = Number(product.stock) || 0; 
          
          if (qty > currentStock) { alert("Cantidad excede stock actual"); return; }
          
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', String(product.id)), {
            stock: Math.max(0, currentStock - qty)
          });
          setActionModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    };

    const toggleExpand = (key) => setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));
    const groupedProducts = products.reduce((acc, p) => {
      const cat = p.category || 'Sin Categoría'; if (!acc[cat]) acc[cat] = {}; if (!acc[cat][p.name]) acc[cat][p.name] = []; acc[cat][p.name].push(p); return acc;
    }, {});

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Almacén General</h2>
        {Object.entries(groupedProducts).map(([cat, names]) => (
          <div key={cat} className="space-y-2"><h3 className="text-pink-800 font-bold bg-pink-100 px-4 py-2 rounded-lg inline-block text-sm">{cat}</h3>
            <div className="grid gap-3">{Object.entries(names).map(([name, variants]) => {
              const total = variants.reduce((s, v) => s + (parseInt(v.stock)||0), 0);
              const key = `${cat}-${name}`;
              return (
                <Card key={key} className="overflow-hidden border border-gray-200">
                  <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(key)}>
                    <div className="flex items-center gap-3"><div className="p-1 rounded-full bg-gray-100">{expandedProducts[key] ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}</div><div><h4 className="font-bold">{name}</h4><p className="text-xs text-gray-500">{variants.length} variantes</p></div></div>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${total<5?'bg-red-100 text-red-600':'bg-green-100 text-green-700'}`}>Total: {total}</span>
                  </div>
                  {expandedProducts[key] && <div className="bg-gray-50 border-t"><table className="w-full text-sm text-left"><thead className="text-gray-500 text-xs bg-gray-100"><tr><th className="px-4 py-2">Talla/Color</th>{showCost && <th className="px-4 py-2">Costo</th>}<th className="px-4 py-2">Venta</th><th className="px-4 py-2">Stock</th>{canEdit && <th className="px-4 py-2 text-right"></th>}</tr></thead><tbody className="divide-y divide-gray-200">{variants.map(v => (<tr key={v.id}><td className="px-4 py-2 font-bold">{v.size} {v.color && <span className="text-gray-500 font-normal">({v.color})</span>}
                  {v.description && <p className="text-[10px] text-gray-400 italic mt-0.5">{v.description}</p>}
                  {v.barcode && <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 w-fit px-1 rounded border border-blue-100 mt-1"><Barcode size={10}/> {v.barcode}</div>}
                  </td>{showCost && <td className="px-4 py-2 text-gray-500">S/ {v.cost}</td>}<td className="px-4 py-2">{showFinancials ? `S/ ${v.price}` : '***'}</td><td className="px-4 py-2">{v.stock}</td>{canEdit && <td className="px-4 py-2 text-right"><div className="flex justify-end gap-2">{canMerma && <button onClick={(e) => { e.stopPropagation(); clickDiscountStock(v); }} className="text-orange-400 hover:text-orange-600 p-2 hover:bg-orange-50 rounded" title="Descontar Stock"><MinusCircle size={20}/></button>}{canDelete && <button onClick={(e) => { e.stopPropagation(); clickDeleteProduct(v.id); }} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"><Trash2 size={20}/></button>}</div></td>}</tr>))}</tbody></table></div>}
                </Card>
              );
            })}</div>
          </div>
        ))}
      </div>
    );
  };

  const DashboardView = () => {
    if (!hasPermission(appUser, 'view_dashboard')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;
    
    const showFinancials = hasPermission(appUser, 'view_financials');
    const [aiTips, setAiTips] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0); // Calculate Expenses
    const lowStock = products.filter(p => p.stock < 5).length;
    const totalItems = products.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0);
    // Ganancia Bruta (Ventas - Costo Producto)
    const grossProfit = sales.reduce((total, sale) => total + ((sale.total || 0) - (sale.items?.reduce((acc, i) => acc + ((i.cost || 0) * i.qty), 0) || 0)), 0);
    // Ganancia Neta Real (Bruta - Gastos)
    const netProfitReal = grossProfit - totalExpenses;

    const getAiCoachTips = async () => {
      setLoadingAi(true);
      const prompt = `Actúa como un analista de negocios experto y motivador para una boutique de ropa. 
      Analiza los siguientes datos actuales de mi tienda en tiempo real:
      - Ventas Totales Históricas: S/ ${totalRevenue}
      - Gastos Operativos: S/ ${totalExpenses}
      - Ganancia Neta Real (después de gastos): S/ ${netProfitReal}
      - Productos con Stock Crítico (<5): ${lowStock}
      - Total de Prendas en Inventario: ${totalItems}
      
      Dame un consejo breve de 3 puntos clave para mejorar el negocio esta semana. Sé directo, estratégico y usa emojis.`;
      
      const response = await callGeminiAPI(prompt);
      setAiTips(response);
      setLoadingAi(false);
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Hola, {appUser?.name} 👋</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-pink-500 to-pink-600 text-white border-none relative overflow-hidden">
            <p className="text-pink-100 text-sm">Ventas Totales</p>
            <h3 className="text-3xl font-bold mt-1 flex items-center gap-2">
              {showFinancials ? `S/ ${totalRevenue.toLocaleString()}` : '****'}
              {!showFinancials && <EyeOff size={20} className="text-pink-300"/>}
            </h3>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none relative overflow-hidden">
            <div className="flex justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Ganancia Neta Real</p>
                <h3 className="text-3xl font-bold mt-1 flex items-center gap-2">
                  {showFinancials ? `S/ ${netProfitReal.toLocaleString()}` : '****'}
                  {!showFinancials && <EyeOff size={20} className="text-emerald-300"/>}
                </h3>
              </div>
              <DollarSign size={24}/>
            </div>
            {showFinancials && <p className="text-[10px] text-emerald-100 mt-1 opacity-80">Después de S/ {totalExpenses} en gastos</p>}
          </Card>

          <Card className="p-6"><p className="text-gray-500 text-sm">Stock Total</p><h3 className="text-3xl font-bold mt-1">{totalItems}</h3></Card>
          <Card className="p-6"><p className="text-gray-500 text-sm">Alertas Stock</p><h3 className="text-3xl font-bold mt-1 text-orange-600">{lowStock}</h3></Card>
        </div>

        {/* AI COACH SECTION */}
        <div className="mt-8">
          <Card className="p-6 border-2 border-violet-100 bg-gradient-to-r from-violet-50 to-white relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
               <div>
                 <h3 className="text-xl font-bold text-violet-800 flex items-center gap-2">
                   <BrainCircuit className="text-violet-600" /> Nicky AI Coach
                 </h3>
                 <p className="text-sm text-gray-500">Tu analista de negocios personal impulsado por Inteligencia Artificial</p>
               </div>
               <Button variant="ai" onClick={getAiCoachTips} disabled={loadingAi}>
                 {loadingAi ? 'Analizando...' : '✨ Analizar Mi Negocio'}
               </Button>
            </div>
            
            {aiTips && (
              <div className="bg-white p-4 rounded-xl border border-violet-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex gap-3">
                  <Lightbulb className="text-yellow-500 shrink-0 mt-1" />
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {aiTips}
                  </div>
                </div>
              </div>
            )}
            {!aiTips && !loadingAi && (
              <div className="text-center py-4 text-gray-400 text-sm italic">
                Presiona el botón para recibir consejos estratégicos basados en tus datos reales.
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  const POSView = () => {
    if (!hasPermission(appUser, 'access_pos')) return <div className="text-center p-10 text-gray-400">Acceso restringido</div>;
    
    const canChangePrice = hasPermission(appUser, 'change_pos_price');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [mobileCartOpen, setMobileCartOpen] = useState(false); 
    const categories = ['Todas', ...(configOptions.categories || [])]; 
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory === 'Todas' || p.category === selectedCategory));
    const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    // --- LÓGICA DE ESCÁNER DE CÓDIGO DE BARRAS ---
    useEffect(() => {
      let buffer = "";
      let lastKeyTime = Date.now();

      const handleKeyDown = (e) => {
        // Evitar input en campos de texto normales si no es el objetivo
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const currentTime = Date.now();
        const char = e.key;
        
        // Si pasa mucho tiempo entre teclas, reiniciar buffer (diferencia tipeo manual vs escáner)
        if (currentTime - lastKeyTime > 100) {
          buffer = "";
        }
        lastKeyTime = currentTime;

        if (char === "Enter") {
           if (buffer.length > 0) {
             const product = products.find(p => p.barcode === buffer);
             if (product) {
               if (product.stock > 0) {
                 addToCart(product);
                 // Feedback visual o sonoro opcional aquí
                 console.log("Producto escaneado:", product.name);
               } else {
                 alert("¡Producto sin stock!");
               }
             }
             buffer = "";
           }
        } else if (char.length === 1) {
           buffer += char;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [products]); // Dependencia products para buscar en la lista actualizada

    return (
      <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-4 relative">
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <div className="mb-4 space-y-3 shrink-0">
            <div className="flex gap-2">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input type="text" placeholder="Buscar por nombre..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
               <div className="hidden md:flex items-center px-3 bg-gray-100 rounded-lg text-xs text-gray-500 gap-2 border border-gray-200" title="Escanea un código con tu lector USB">
                 <ScanBarcode size={18} />
                 <span>Lector Activo</span>
               </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-pink-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}>{cat}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 pb-24 md:pb-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} className={`relative group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-left hover:shadow-md active:scale-95 transition-transform ${p.stock <= 0 ? 'opacity-50 grayscale' : ''}`}>
                  <div className="aspect-[4/5] bg-gray-100 relative">
                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={32} /></div>}
                    <div className="absolute top-2 left-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">{p.size}</div>
                    <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm">Stock: {p.stock}</div>
                  </div>
                  <div className="p-3"><p className="font-semibold text-gray-800 text-sm line-clamp-1">{p.name} {p.color && <span className="text-gray-500 font-normal">({p.color})</span>}</p><p className="text-pink-600 font-bold mt-1">S/ {p.price}</p></div>
                </button>
              ))}
            </div>
          </div>
        </div>
        {!mobileCartOpen && cart.length > 0 && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-50 flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-full" onClick={() => setMobileCartOpen(true)}><div><p className="text-xs text-gray-500">{totalItems} ítems</p><p className="font-bold text-xl text-pink-700">S/ {cartTotal.toFixed(2)}</p></div><button className="bg-pink-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg">Ver Carrito <ChevronUp size={20}/></button></div>
        )}
        <div className={`fixed inset-0 z-50 bg-white flex flex-col transition-transform duration-300 ease-in-out md:static md:w-56 md:bg-transparent md:translate-y-0 md:z-0 ${mobileCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
          <div className="p-4 border-b border-gray-100 bg-pink-50/80 backdrop-blur flex justify-between items-center md:rounded-t-2xl"><h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><ShoppingCart className="text-pink-600" size={18} /> Carrito</h3><button className="md:hidden p-2 bg-gray-100 rounded-full text-gray-600" onClick={() => setMobileCartOpen(false)}><ChevronDown size={24} /></button></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white md:border-x md:border-pink-100">
            {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2"><ShoppingBag size={40} className="opacity-20" /><p className="text-sm">Carrito vacío</p><button className="md:hidden text-pink-600 font-medium text-xs mt-4" onClick={() => setMobileCartOpen(false)}>Volver a productos</button></div> : cart.map(item => (
              <div key={item.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="w-10 h-10 bg-white rounded border overflow-hidden shrink-0">{item.image ? <img src={item.image} className="w-full h-full object-cover"/> : <ImageIcon className="p-1.5 text-gray-300 w-full h-full"/>}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate text-gray-800">{item.name}</p><p className="text-[10px] text-gray-500">{item.size} {item.color && `/ ${item.color}`}</p>
                  <div className="mt-1"><div className="flex items-center gap-1"><span className="text-[10px] text-gray-400">Unit:</span><input type="number" min="0" disabled={!canChangePrice} className={`w-16 p-0.5 text-xs font-bold text-pink-600 border border-pink-100 rounded focus:ring-1 focus:ring-pink-500 outline-none ${!canChangePrice ? 'bg-gray-100 text-gray-500' : ''}`} value={item.price} onChange={(e) => updateCartPrice(item.id, e.target.value)}/></div><div className="text-[9px] text-gray-400 text-right">Ref: S/ {item.originalPrice || item.price}</div></div>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm"><button onClick={() => updateCartQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 text-gray-600 text-xs">-</button><span className="text-xs font-medium w-3 text-center">{item.qty}</span><button onClick={() => updateCartQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 text-gray-600 text-xs">+</button></div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white border-t border-gray-100 md:border-x md:border-b md:border-pink-100 md:rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"><div className="flex justify-between items-end mb-3"><span className="text-gray-500 text-sm">Total</span><span className="text-2xl font-bold text-gray-900">S/ {cartTotal.toFixed(2)}</span></div><Button onClick={() => { processSale(); setMobileCartOpen(false); }} disabled={cart.length === 0} className="w-full py-2.5 text-base shadow-pink-200 shadow-lg">Cobrar <ChevronRight size={18} /></Button></div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-pink-50 text-pink-600 font-bold">Cargando...</div>;
  if (!appUser || view === 'login') return <LoginView />;
  if (view === 'public_catalog') return <CatalogView />; // Vista Pública fuera del dashboard principal

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col md:flex-row font-sans text-gray-900 relative">
      {addModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setAddModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">{addModalConfig.type === 'name' ? `Agregar nombre a "${addModalConfig.categoryContext}"` : `Agregar nueva ${addModalConfig.type === 'category' ? 'Categoría' : 'Talla'}`}</h3>
            <form onSubmit={handleSaveNewOption}><Input autoFocus value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} placeholder="Escribe aquí..." /><div className="flex gap-2 justify-end mt-4"><Button variant="secondary" onClick={() => setAddModalOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></div></form>
          </Card>
        </div>
      )}

      {/* MODAL PARA EDITAR PERFIL PROPIO */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setProfileModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                <UserCog size={20}/>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Editar Mi Perfil</h3>
            </div>
            
            <form onSubmit={handleUpdateProfile}>
              <Input 
                label="Tu Nombre" 
                value={profileData.name} 
                onChange={(e) => setProfileData({...profileData, name: e.target.value})} 
                required 
              />
              <Input 
                label="Usuario (Login)" 
                value={profileData.username} 
                onChange={(e) => setProfileData({...profileData, username: e.target.value})} 
                required 
              />
              <Input 
                label="Nueva Contraseña" 
                type="password"
                placeholder="Deja en blanco si no quieres cambiarla"
                value={profileData.password} 
                onChange={(e) => setProfileData({...profileData, password: e.target.value})} 
                required 
              />
              
              <div className="flex gap-2 justify-end mt-6">
                <Button variant="secondary" onClick={() => setProfileModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-gradient-to-r from-pink-600 to-purple-600">Actualizar Datos</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* RENDERIZADO DEL MODAL DE ACCIÓN GLOBAL */}
      <ActionModal 
        isOpen={actionModal.isOpen} 
        onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))} 
        onConfirm={actionModal.onConfirm}
        title={actionModal.title}
        message={actionModal.message}
        type={actionModal.type}
        inputType={actionModal.inputType}
      />

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed md:sticky top-0 left-0 h-full w-64 bg-white border-r border-pink-100 shadow-xl md:shadow-none z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex justify-between items-center shrink-0"><div><h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Nicky B.</h1><p className="text-xs text-gray-400 tracking-widest mt-1">MANAGER PRO</p></div><button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400"><X size={24} /></button></div>
        <nav className="px-4 space-y-1 flex-1 overflow-y-auto">
          {hasPermission(appUser, 'view_dashboard') && <button onClick={() => { setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><LayoutDashboard size={20} /> Dashboard</button>}
          {hasPermission(appUser, 'access_pos') && <button onClick={() => { setView('pos'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'pos' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><ShoppingCart size={20} /> Punto de Venta</button>}
          {hasPermission(appUser, 'view_sales_history') && <button onClick={() => { setView('sales_history'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'sales_history' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><History size={20} /> Historial Ventas</button>}
          {hasPermission(appUser, 'manage_expenses') && <button onClick={() => { setView('expenses'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'expenses' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><Wallet size={20} /> Caja y Gastos</button>}
          
          {(hasPermission(appUser, 'add_products') || hasPermission(appUser, 'view_inventory')) && <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Gestión</div>}
          {hasPermission(appUser, 'add_products') && <button onClick={() => { setView('add_inventory'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'add_inventory' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><ListPlus size={20} /> Agregar Inventario</button>}
          {hasPermission(appUser, 'view_inventory') && <button onClick={() => { setView('stock_list'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'stock_list' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><Package size={20} /> Ver Inventario</button>}
          {hasPermission(appUser, 'view_reports') && <button onClick={() => { setView('reports'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'reports' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><ClipboardList size={20} /> Reportes</button>}
          {hasPermission(appUser, 'manage_users') && <button onClick={() => { setView('users'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'users' ? 'bg-pink-50 text-pink-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={20} /> Usuarios</button>}
          
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Extras</div>
          <button onClick={() => setView('public_catalog')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-50 text-left"><Share2 size={20} /> Catálogo Digital</button>
        </nav>
        <div className="p-4 border-t border-gray-100 mt-auto shrink-0 bg-white">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold bg-gray-400`}>{appUser.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate">{appUser.name}</p>
                {/* BOTÓN EDITAR PERFIL */}
                <button onClick={openProfileModal} className="text-gray-400 hover:text-pink-600 transition-colors" title="Editar mi perfil">
                  <Edit size={14} />
                </button>
              </div>
              <p className="text-xs text-gray-500 capitalize">{ROLE_PRESETS[appUser.role]?.label || appUser.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200 p-4 flex justify-between items-center"><h1 className="font-bold text-lg text-gray-800 capitalize">{view.replace('_', ' ')}</h1><button onClick={() => setSidebarOpen(true)} className="p-2.5 bg-pink-50 text-pink-700 rounded-lg"><Menu size={24} /></button></div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {view === 'dashboard' && <DashboardView />}
          {view === 'pos' && <POSView />}
          {view === 'add_inventory' && <AddInventoryView />}
          {view === 'stock_list' && <StockView />}
          {view === 'reports' && <ReportsView />}
          {view === 'users' && <UsersView />}
          {view === 'expenses' && <ExpensesView />}
          {view === 'sales_history' && <SalesHistoryView />}
        </div>
      </main>
    </div>
  );
}