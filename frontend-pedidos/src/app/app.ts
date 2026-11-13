import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export interface Pedido {
  id?: number;
  tracking: string;
  cliente: string;
  producto: string;
  cantidad: number;
  total: number;
  courier: string;
  destino: string;
  estado: string;
  incidencia?: string;
  // Trazabilidad (la entrega el servidor)
  fechaCreacion?: string;
  creadoPor?: string;
  cotizacionOrigenId?: number;
  aceptadaPor?: string;
  fechaAceptacion?: string;
  fechaCierre?: string;
  eliminado?: boolean;
  fechaEliminacion?: string;
  eliminadoPor?: string;
}

export interface Producto {
  id?: number;
  sku: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  imagen?: string;
}

export interface Cotizacion {
  id: number;
  cliente: string;
  email?: string;
  producto: string;
  productoId?: number;
  sku?: string;
  cantidad: number;
  region: string;
  comuna: string;
  totalEst: number;
  estado: 'PENDIENTE' | 'CONTACTADO' | 'ACEPTADA' | 'RECHAZADA' | 'CONVERTIDA';
  fechaCreacion?: string;
  fechaAceptacion?: string;
  aceptadaPor?: string;
  fechaCierre?: string;
  pedidoTracking?: string;
  creadaPor?: string;
}

export interface EventoHistorial {
  id: number;
  tipo: string;
  entidadId: number;
  accion: string;
  detalle?: string;
  usuario?: string;
  fecha: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  moduloActivo: 'PEDIDOS' | 'PRODUCTOS' | 'COTIZACIONES' | 'ARCHIVO' | 'INDICADORES' = 'PEDIDOS';

  // Control de vistas para la landing page pública (cambio instantáneo de vista)
  seccionPublica: 'inicio' | 'catalogo' = 'inicio';

  userName = 'Usuario';
  rolSeleccionado: 'OPERADOR' | 'ADMIN' = 'ADMIN';
  pedidos: Pedido[] = [];
  productos: Producto[] = this.catalogoRespaldo(); // se muestra al instante; los datos del servidor lo reemplazan al llegar
  cargando = false;
  notificacionReciente: string = '';

  // --- LISTA DE ERRORES DE VALIDACIÓN PARA EL POP-UP CENTRADO ---
  erroresValidacion: string[] = [];

private apiPedidosUrl = environment.apiUrl;
private apiProductosUrl = environment.apiUrl.replace(/\/pedidos$/, '/productos');
private apiCotizacionesUrl = environment.apiUrl.replace(/\/pedidos$/, '/cotizaciones');

  // Sesión activa y cabecera con el nombre de quien realiza cada acción (queda en el historial)
  sesionActiva = false;
  private opciones() {
    const quien = this.sesionActiva ? this.userName : 'Portal público';
    return { headers: { 'X-Usuario': encodeURIComponent(quien) } };
  }

  // Estados completos del flujo logístico
  estadosDisponibles: string[] = [
    'En Preparacion',
    'Listo para Despacho',
    'En Transito',
    'En Reparto',
    'Entregado',
    'Incidencia en Ruta'
  ];

  couriersDisponibles: string[] = ['Blue Express', 'Chilexpress', 'Flota Propia'];

  mostrarFormularioCreacion = false;
  mostrarFormularioProducto = false;
  pedidoEnEdicion: Pedido | null = null;
  pedidoParaIncidencia: Pedido | null = null;
  detalleIncidenciaTemp = '';

  // Control de estado para edición de productos
  productoEnEdicion: Producto | null = null;

  // Filtro de clasificación por Estado (Exclusivo Administrador)
  filtroEstadoSeleccionado: string = 'TODOS';

  // --- ESTRUCTURA DE REGIONES Y COMUNAS Y CARRITO DE MÚLTIPLES PRODUCTOS ---
  comunasDisponibles: string[] = [];

  nuevoPedido = {
    cliente: '',
    region: '',
    comuna: '',
    items: [] as { producto: string; cantidad: number; precioUnitario: number; subtotal: number }[],
    productoTemp: '',
    cantidadTemp: 1,
    total: 0,
    courier: '',
    destino: ''
  };

  nuevoProducto: Producto = {
    sku: '',
    nombre: '',
    descripcion: '',
    categoria: 'General',
    precio: 0,
    stock: 10,
    stockMinimo: 5,
    imagen: ''
  };

  ngOnInit(): void {
    this.cargarCacheLocal();
    this.obtenerPedidos();
    this.obtenerProductos();

    // Diagnóstico en consola para capturar errores de Auth0
    this.auth.error$.subscribe(err => {
      console.error('ERROR DE AUTH0:', err);
    });

    this.auth.isAuthenticated$.subscribe(autenticado => {
      console.log('¿Estado de autenticación?:', autenticado);
      this.sesionActiva = autenticado;
      // Al iniciar sesión se vuelve a pedir el catálogo, ahora con el token
      if (autenticado) {
        this.obtenerProductos();
        this.cargarCotizaciones();
      }
    });

    // Sincronización del perfil de Auth0 y detección de ROL
    this.auth.user$.subscribe((user) => {
      if (user) {
        this.ngZone.run(() => {
          const identificador = (user.email || user.name || user.nickname || '').toLowerCase();
          this.userName = user.name || user.email || 'Usuario Evaluador';

          if (identificador.includes('bodega')) {
            this.rolSeleccionado = 'OPERADOR';
          } else {
            this.rolSeleccionado = 'ADMIN';
          }

          this.cdr.detectChanges();
        });
      }
    });
  }

  // --- FILTRO POR ESTADO PARA EL ADMINISTRADOR ---
  get pedidosFiltrados(): Pedido[] {
    if (this.filtroEstadoSeleccionado === 'TODOS') {
      return this.pedidos;
    }
    return this.pedidos.filter(p => p.estado === this.filtroEstadoSeleccionado);
  }

  seleccionarFiltroEstado(estado: string): void {
    this.filtroEstadoSeleccionado = estado;
  }

  getPorcentaje(cantidad: number): number {
    if (!this.pedidos.length) return 0;
    return Math.round((cantidad / this.pedidos.length) * 100);
  }

  // --- ACCIONES DE AUTENTICACIÓN AUTH0 ---
  login(): void {
    this.auth.loginWithRedirect();
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  cambiarModulo(modulo: 'PEDIDOS' | 'PRODUCTOS' | 'COTIZACIONES' | 'ARCHIVO' | 'INDICADORES'): void {
    this.ngZone.run(() => {
      this.moduloActivo = modulo;
      this.menuAbierto = false;
      if (modulo === 'INDICADORES') { this.iniciarRefrescoPanel(); } else { this.detenerRefrescoPanel(); }
      this.cdr.detectChanges();
    });
    if (modulo === 'ARCHIVO' || modulo === 'INDICADORES') this.cargarArchivo();
    if (modulo === 'COTIZACIONES' || modulo === 'INDICADORES') this.cargarCotizaciones();
  }

  cambiarSeccionPublica(seccion: 'inicio' | 'catalogo'): void {
    this.ngZone.run(() => {
      this.seccionPublica = seccion;
      this.cdr.detectChanges();
    });
  }

  // --- MODAL DE EDICIÓN GENERAL DE PEDIDOS ---
  abrirModalEditar(pedido: Pedido): void {
    this.ngZone.run(() => {
      this.pedidoEnEdicion = { ...pedido };
      this.cdr.detectChanges();
    });
  }

  cerrarModalEditar(): void {
    this.ngZone.run(() => {
      this.pedidoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  guardarEdicion(): void {
    if (!this.pedidoEnEdicion?.id) return;

    const editado = { ...this.pedidoEnEdicion };
    if (editado.incidencia && editado.incidencia.trim() !== '') {
      editado.estado = 'Incidencia en Ruta';
    }

    this.http.post<Pedido>(this.apiPedidosUrl, editado, this.opciones()).subscribe({
      next: () => this.aplicarEdicionLocal(editado),
      error: () => this.aplicarEdicionLocal(editado)
    });
  }

  private aplicarEdicionLocal(editado: Pedido): void {
    this.ngZone.run(() => {
      const idx = this.pedidos.findIndex(p => p.id === editado.id);
      if (idx !== -1) {
        this.pedidos[idx] = { ...editado };
        this.notificacionReciente = `Orden ${editado.tracking} actualizada correctamente`;
        this.guardarCacheLocal();
      }
      this.pedidoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  // --- MODAL DE INCIDENCIAS ---
  abrirModalIncidencia(pedido: Pedido): void {
    this.ngZone.run(() => {
      this.pedidoParaIncidencia = pedido;
      this.detalleIncidenciaTemp = pedido.incidencia || '';
      this.cdr.detectChanges();
    });
  }

  cerrarModalIncidencia(): void {
    this.ngZone.run(() => {
      this.pedidoParaIncidencia = null;
      this.detalleIncidenciaTemp = '';
      this.cdr.detectChanges();
    });
  }

  guardarIncidencia(): void {
    if (!this.pedidoParaIncidencia?.id) return;

    const id = this.pedidoParaIncidencia.id;
    const motivo = this.detalleIncidenciaTemp.trim();
    const nuevoEstado = motivo ? 'Incidencia en Ruta' : 'En Transito';
    const tracking = this.pedidoParaIncidencia.tracking;

    this.http.patch<Pedido>(`${this.apiPedidosUrl}/${id}/incidencia`, { incidencia: motivo }, this.opciones()).subscribe({
      next: () => {
        this.aplicarCambioIncidenciaLocal(id, motivo || undefined, nuevoEstado, tracking);
      },
      error: () => {
        this.aplicarCambioIncidenciaLocal(id, motivo || undefined, nuevoEstado, tracking);
      }
    });
  }

  solucionarIncidencia(): void {
    this.detalleIncidenciaTemp = '';
    this.guardarIncidencia();
  }

  private aplicarCambioIncidenciaLocal(id: number, motivo: string | undefined, nuevoEstado: string, tracking: string): void {
    this.ngZone.run(() => {
      const item = this.pedidos.find(p => p.id === id);
      if (item) {
        item.incidencia = motivo;
        item.estado = nuevoEstado;
        this.notificacionReciente = motivo 
          ? `Incidencia registrada en guía [${tracking}]: ${motivo}` 
          : `Incidencia resuelta para la guía [${tracking}]`;
        this.guardarCacheLocal();
      }
      this.pedidoParaIncidencia = null;
      this.detalleIncidenciaTemp = '';
      this.cdr.detectChanges();
    });
  }

  // --- GESTIÓN DE PRODUCTOS ---
// Diccionario de emojis y colores corporativos por categoría
  iconos: Record<string, { emoji: string; fondo: string }> = {
    'Aseo': { emoji: '🧴', fondo: '#e0f2fe' },
    'Abarrotes': { emoji: '🌾', fondo: '#fef3c7' },
    'Bebidas': { emoji: '🥤', fondo: '#fde8ec' },
    'Lácteos': { emoji: '🥛', fondo: '#f1f5f9' },
    'Ferretería y Empaque': { emoji: '📦', fondo: '#ede9fe' },
    'Oficina': { emoji: '🖇️', fondo: '#dcfce7' }
  };

  iconoDe(p: any) {
    return this.iconos[p.categoria] || { emoji: '📦', fondo: '#f1f5f9' };
  }

  // Indica si el catálogo viene del servidor o de la lista de respaldo (sin conexión al backend)
  catalogoDesdeServidor = false;

  // Lista de respaldo: solo se usa si el backend no responde
  private catalogoRespaldo(): Producto[] {
    const base = [
      { id: 1, sku: 'ASEO-001', nombre: 'Detergente Industrial 5L', descripcion: 'Bidón concentrado para aseo profundo', categoria: 'Aseo', precio: 12990, stock: 45, stockMinimo: 10 },
      { id: 2, sku: 'ASEO-002', nombre: 'Cloro Gel Desinfectante 1L', descripcion: 'Envase individual alta desinfección', categoria: 'Aseo', precio: 2490, stock: 40, stockMinimo: 15 },
      { id: 3, sku: 'ABAR-001', nombre: 'Arroz Grado 1 Saco 10kg', descripcion: 'Grano selecto para abastecimiento', categoria: 'Abarrotes', precio: 11500, stock: 120, stockMinimo: 20 },
      { id: 4, sku: 'ABAR-002', nombre: 'Aceite Vegetal Comestible Bidón 5L', descripcion: 'Aceite refinado para cocinas', categoria: 'Abarrotes', precio: 9890, stock: 50, stockMinimo: 12 },
      { id: 5, sku: 'BEB-001', nombre: 'Bebida Cola Retornable 1.5L Pack 6', descripcion: 'Ideal para almacenes', categoria: 'Bebidas', precio: 7500, stock: 80, stockMinimo: 15 },
      { id: 6, sku: 'BEB-002', nombre: 'Agua Mineral Sin Gas 500cc Pack 24', descripcion: 'Formato individual comercial', categoria: 'Bebidas', precio: 8900, stock: 90, stockMinimo: 20 },
      { id: 7, sku: 'LAC-001', nombre: 'Leche Entera UHT 1L Caja 12', descripcion: 'Larga vida envasada', categoria: 'Lácteos', precio: 10990, stock: 50, stockMinimo: 10 },
      { id: 8, sku: 'FER-001', nombre: 'Cinta de Embalaje Transparente 48mmx100m', descripcion: 'Alta resistencia industrial', categoria: 'Ferretería y Empaque', precio: 1990, stock: 150, stockMinimo: 30 },
      { id: 9, sku: 'FER-002', nombre: 'Caja de Cartón Corrugado N4 Pack 10', descripcion: 'Para envíos y bodegaje', categoria: 'Ferretería y Empaque', precio: 8500, stock: 75, stockMinimo: 15 },
      { id: 10, sku: 'OFI-001', nombre: 'Resma Papel Bond Oficio 500 Hojas', descripcion: 'Papel certificado impresión', categoria: 'Oficina', precio: 5900, stock: 80, stockMinimo: 20 }
    ];
    return base.map(p => ({ ...p, imagen: `productos/${p.sku}.jpg` }));
  }

  // El backend entrega "stockActual"; la pantalla trabaja con "stock"
  private normalizarProducto(p: any): Producto {
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      categoria: p.categoria ?? 'General',
      precio: Number(p.precio),
      stock: Number(p.stock ?? p.stockActual ?? 0),
      stockMinimo: Number(p.stockMinimo ?? 0),
      imagen: p.imagen || ''
    };
  }

  // Formato que espera el backend al crear o editar un producto
  private toApiProducto(p: Producto): any {
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      precio: p.precio,
      stockActual: p.stock,
      stockMinimo: p.stockMinimo,
      imagen: p.imagen || null
    };
  }

  obtenerProductos(): void {
    this.http.get<any[]>(this.apiProductosUrl).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.catalogoDesdeServidor = true;
          this.productos = (data ?? []).map(p => this.normalizarProducto(p));
          this.cdr.detectChanges();
        });
      },
      error: (e) => {
        console.error('No se pudo cargar el catálogo desde el servidor, se usa la lista de respaldo:', e);
        this.ngZone.run(() => {
          this.catalogoDesdeServidor = false;
          this.productos = this.catalogoRespaldo();
          this.cdr.detectChanges();
        });
      }
    });
  }

  guardarNuevoProducto(): void {
    if (!this.nuevoProducto.sku.trim() || !this.nuevoProducto.nombre.trim()) {
      alert('Debe ingresar SKU y Nombre del producto.');
      return;
    }

    this.http.post<any>(this.apiProductosUrl, this.toApiProducto(this.nuevoProducto)).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          const prod = this.normalizarProducto(creado);
          this.productos.unshift(prod);
          this.notificacionReciente = `Producto registrado: ${prod.nombre} (${prod.sku})`;
          this.resetFormularioProducto();
        });
      },
      error: (e) => {
        console.error('POST producto falló:', e);
        this.ngZone.run(() => {
          this.notificacionReciente = 'No se pudo registrar el producto en el servidor';
          this.cdr.detectChanges();
        });
      }
    });
  }

  resetFormularioProducto(): void {
    this.nuevoProducto = { sku: '', nombre: '', descripcion: '', categoria: 'General', precio: 0, stock: 10, stockMinimo: 5, imagen: '' };
    this.mostrarFormularioProducto = false;
    this.cdr.detectChanges();
  }

  // --- ACCIONES CRUD PRODUCTOS (ADMIN) ---
  abrirModalEditarProducto(producto: Producto): void {
    this.ngZone.run(() => {
      this.productoEnEdicion = { ...producto };
      this.cdr.detectChanges();
    });
  }

  cerrarModalEditarProducto(): void {
    this.ngZone.run(() => {
      this.productoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  guardarEdicionProducto(): void {
    if (!this.productoEnEdicion?.id) return;

    const editado = { ...this.productoEnEdicion };
    this.http.put<any>(`${this.apiProductosUrl}/${editado.id}`, this.toApiProducto(editado)).subscribe({
      next: (guardado) => this.aplicarEdicionProductoLocal(this.normalizarProducto(guardado)),
      error: (e) => {
        console.error('PUT producto falló:', e);
        this.ngZone.run(() => {
          this.notificacionReciente = `No se pudo actualizar ${editado.sku} en el servidor`;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private aplicarEdicionProductoLocal(editado: Producto): void {
    this.ngZone.run(() => {
      const idx = this.productos.findIndex(p => p.id === editado.id);
      if (idx !== -1) {
        this.productos[idx] = { ...editado };
        this.notificacionReciente = `Producto ${editado.sku} actualizado correctamente`;
      }
      this.productoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  ajustarStockRapido(producto: Producto, delta: number): void {
    if (this.rolSeleccionado !== 'ADMIN') return;
    const stockAnterior = producto.stock;
    const nuevoStock = Math.max(0, stockAnterior + delta);
    producto.stock = nuevoStock;

    this.http.patch(`${this.apiProductosUrl}/${producto.id}/stock`, { stock: nuevoStock }).subscribe({
      next: () => {
        this.notificacionReciente = `Stock de ${producto.nombre}: ${nuevoStock} unidades`;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('PATCH stock falló:', e);
        producto.stock = stockAnterior; // se deshace el cambio: el servidor no lo guardó
        this.notificacionReciente = `No se pudo actualizar el stock de ${producto.nombre} en el servidor`;
        this.cdr.detectChanges();
      }
    });
  }

  eliminarProducto(id: number | undefined, sku: string): void {
    if (!id || this.rolSeleccionado !== 'ADMIN') return;
    if (confirm(`¿Seguro que deseas eliminar el producto ${sku} del catálogo?`)) {
      this.http.delete(`${this.apiProductosUrl}/${id}`).subscribe({
        next: () => this.removerProductoLocal(id, sku),
        error: (e) => {
          console.error('DELETE producto falló:', e);
          this.ngZone.run(() => {
            this.notificacionReciente = `No se pudo eliminar ${sku} en el servidor`;
            this.cdr.detectChanges();
          });
        }
      });
    }
  }

  private removerProductoLocal(id: number, sku: string): void {
    this.ngZone.run(() => {
      this.productos = this.productos.filter(p => p.id !== id);
      this.notificacionReciente = `Producto eliminado: ${sku}`;
      this.cdr.detectChanges();
    });
  }

  // --- GESTIÓN DE PEDIDOS ---
  obtenerPedidos(): void {
    this.cargando = true;
    this.http.get<Pedido[]>(this.apiPedidosUrl).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          if (Array.isArray(data)) {
            this.pedidos = data.map((item, idx) => this.normalizarPedido(item, idx));
            this.guardarCacheLocal();
          }
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.cargarCacheLocal();
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private normalizarPedido(p: any, index: number = 0): Pedido {
    return {
      id: p.id || (index + 1),
      tracking: p.tracking || `TRK-CL-${1000 + (index + 1) * 219}`,
      cliente: p.cliente || 'Cliente sin registrar',
      producto: p.producto || 'Insumo Logístico',
      cantidad: p.cantidad || 1,
      total: p.total || 0,
      courier: p.courier || 'Blue Express',
      destino: p.destino || 'Santiago Centro',
      estado: this.normalizarEstado(p.estado),
      incidencia: p.incidencia || '',
      fechaCreacion: p.fechaCreacion || undefined,
      creadoPor: p.creadoPor || undefined,
      cotizacionOrigenId: p.cotizacionOrigenId ?? undefined,
      aceptadaPor: p.aceptadaPor || undefined,
      fechaAceptacion: p.fechaAceptacion || undefined,
      fechaCierre: p.fechaCierre || undefined,
      eliminado: !!p.eliminado,
      fechaEliminacion: p.fechaEliminacion || undefined,
      eliminadoPor: p.eliminadoPor || undefined
    };
  }

  onRegionChange(event: any): void {
    const regionSeleccionada = event.target.value;
    this.ngZone.run(() => {
      this.nuevoPedido.region = regionSeleccionada;
      this.nuevoPedido.comuna = ''; 

      if (regionSeleccionada === 'Metropolitana') {
        this.comunasDisponibles = ['Santiago', 'Padre Hurtado', 'Colina (Chicureo)', 'Providencia', 'Las Condes', 'Maipú', 'Puente Alto'];
      } else if (regionSeleccionada === 'Valparaiso') {
        this.comunasDisponibles = ['Valparaíso', 'Viña del Mar', 'Concón', 'Villa Alemana', 'Quilpué'];
      } else if (regionSeleccionada === 'OHiggins') {
        this.comunasDisponibles = ['Rancagua', 'Machalí', 'San Fernando', 'Rengo'];
      } else {
        this.comunasDisponibles = [];
      }
      this.cdr.detectChanges();
    });
  }

  // --- MÉTODOS DEL CARRITO ---
  agregarItemAlPedido(): void {
    this.ngZone.run(() => {
      if (!this.nuevoPedido.productoTemp) {
        return;
      }
      const cant = Number(this.nuevoPedido.cantidadTemp) || 1;
      if (cant <= 0) return;

      const prod = this.productos.find(p => p.nombre === this.nuevoPedido.productoTemp);
      if (!prod) return;

      const subtotal = prod.precio * cant;
      this.nuevoPedido.items.push({
        producto: prod.nombre,
        cantidad: cant,
        precioUnitario: prod.precio,
        subtotal: subtotal
      });

      this.calcularTotalGeneral();
      this.nuevoPedido.productoTemp = '';
      this.nuevoPedido.cantidadTemp = 1;
      this.cdr.detectChanges();
    });
  }

  quitarItemPedido(index: number): void {
    this.ngZone.run(() => {
      this.nuevoPedido.items.splice(index, 1);
      this.calcularTotalGeneral();
      this.cdr.detectChanges();
    });
  }

  calcularTotalGeneral(): void {
    this.nuevoPedido.total = this.nuevoPedido.items.reduce((acc, item) => acc + item.subtotal, 0);
  }

  guardarNuevoPedido(): void {
    if (this.rolSeleccionado !== 'ADMIN') return;
    
    this.ngZone.run(() => {
      this.erroresValidacion = [];

      if (!this.nuevoPedido.cliente || !this.nuevoPedido.cliente.trim()) {
        this.erroresValidacion.push('Nombre del cliente');
      }
      if (!this.nuevoPedido.region) {
        this.erroresValidacion.push('Región de destino');
      }
      if (!this.nuevoPedido.comuna) {
        this.erroresValidacion.push('Comuna de destino');
      }
      if (this.nuevoPedido.items.length === 0) {
        this.erroresValidacion.push('Debe agregar al menos 1 producto al detalle');
      }
      if (this.nuevoPedido.total === undefined || this.nuevoPedido.total === null || Number(this.nuevoPedido.total) <= 0) {
        this.erroresValidacion.push('Monto total válido (calculado automáticamente)');
      }
      if (!this.nuevoPedido.courier) {
        this.erroresValidacion.push('Courier de despacho');
      }

      if (this.erroresValidacion.length > 0) {
        this.cdr.detectChanges();
        return;
      }
    });

    if (this.erroresValidacion.length > 0) return;

    const resumenProductos = this.nuevoPedido.items.map(i => `${i.cantidad}x ${i.producto}`).join(', ');
    const cantidadTotalUnidades = this.nuevoPedido.items.reduce((acc, i) => acc + i.cantidad, 0);
    const destinoConsolidado = `${this.nuevoPedido.comuna}, ${this.nuevoPedido.region}`;

    const payload: Pedido = {
      tracking: `TRK-CL-${Math.floor(1000 + Math.random() * 9000)}`,
      cliente: this.nuevoPedido.cliente.trim(),
      producto: resumenProductos,
      cantidad: cantidadTotalUnidades,
      total: Number(this.nuevoPedido.total),
      courier: this.nuevoPedido.courier,
      destino: destinoConsolidado,
      estado: 'En Preparacion'
    };

    this.http.post<Pedido>(this.apiPedidosUrl, payload, this.opciones()).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          this.pedidos.unshift(this.normalizarPedido(creado));
          this.notificacionReciente = `Guía creada con éxito: ${payload.tracking}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.pedidos.unshift({ ...payload, id: Date.now() });
          this.notificacionReciente = `Guía creada con éxito: ${payload.tracking}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      }
    });
  }

  cerrarModalError(): void {
    this.ngZone.run(() => {
      this.erroresValidacion = [];
      this.cdr.detectChanges();
    });
  }

  cambiarRol(nuevoRol: 'OPERADOR' | 'ADMIN'): void {
    this.ngZone.run(() => {
      this.rolSeleccionado = nuevoRol;
      this.cdr.detectChanges();
    });
  }

  cambiarEstado(pedido: Pedido, nuevoEstado: string): void {
    const anterior = pedido.estado;
    this.ngZone.run(() => {
      pedido.estado = nuevoEstado;
      this.cdr.detectChanges();
    });
    this.http.patch<Pedido>(`${this.apiPedidosUrl}/${pedido.id}/estado`, { estado: nuevoEstado }, this.opciones()).subscribe({
      next: () => {
        if (nuevoEstado === 'Entregado') {
          // Las órdenes entregadas salen de Control de Órdenes y quedan en el Archivo
          this.ngZone.run(() => {
            this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
            this.guardarCacheLocal();
            this.notificacionReciente = `Guía ${pedido.tracking} entregada: pasó al Archivo.`;
            this.cdr.detectChanges();
          });
        }
      },
      error: () => {
        this.ngZone.run(() => {
          pedido.estado = anterior;
          this.notificacionReciente = 'No se pudo cambiar el estado en el servidor';
          this.cdr.detectChanges();
        });
      }
    });
  }

  eliminarPedido(id: number | undefined, tracking: string): void {
    if (!id || this.rolSeleccionado !== 'ADMIN') return;
    if (confirm(`¿Eliminar la guía ${tracking} de Control de Órdenes?\n\nQuedará guardada en el Archivo, marcada como eliminada, con tu nombre y la fecha.`)) {
      this.http.delete(`${this.apiPedidosUrl}/${id}`, this.opciones()).subscribe({
        next: () => this.removerLocal(id, tracking),
        error: () => this.ngZone.run(() => {
          this.notificacionReciente = `No se pudo eliminar la guía ${tracking} en el servidor`;
          this.cdr.detectChanges();
        })
      });
    }
  }

  private removerLocal(id: number, tracking: string): void {
    this.ngZone.run(() => {
      this.pedidos = this.pedidos.filter(p => p.id !== id);
      this.notificacionReciente = `Guía ${tracking} eliminada de Control de Órdenes (queda en el Archivo).`;
      this.guardarCacheLocal();
      this.cdr.detectChanges();
    });
  }

  toggleFormulario(): void {
    this.ngZone.run(() => {
      this.mostrarFormularioCreacion = !this.mostrarFormularioCreacion;
      this.cdr.detectChanges();
    });
  }

  resetFormulario(): void {
    this.nuevoPedido = { cliente: '', region: '', comuna: '', items: [], productoTemp: '', cantidadTemp: 1, total: 0, courier: '', destino: '' };
    this.comunasDisponibles = [];
    this.mostrarFormularioCreacion = false;
    this.cdr.detectChanges();
  }

  cargarCacheLocal(): void {
    const cache = localStorage.getItem('pedidos_app_data');
    if (cache) this.pedidos = JSON.parse(cache);
  }

  guardarCacheLocal(): void { 
    localStorage.setItem('pedidos_app_data', JSON.stringify(this.pedidos)); 
  }

  descartarNotificacion(): void {
    this.ngZone.run(() => {
      this.notificacionReciente = '';
      this.cdr.detectChanges();
    });
  }

  // ---------- Menú lateral adaptable y títulos ----------
  menuAbierto = false;
  alternarMenu(): void { this.menuAbierto = !this.menuAbierto; }

  tituloModulo(): string {
    const titulos: Record<string, string> = {
      PEDIDOS: this.rolSeleccionado === 'ADMIN' ? 'Despachos y envíos' : 'Mesa de picking y bodega',
      PRODUCTOS: 'Inventario y stock',
      COTIZACIONES: 'Bandeja de cotizaciones',
      ARCHIVO: 'Archivo',
      INDICADORES: 'Panel de indicadores'
    };
    return titulos[this.moduloActivo] || 'Pedidos 360';
  }

  // ---------- Panel de indicadores ----------
  clp(valor: number | undefined): string {
    return '$' + Math.round(valor || 0).toLocaleString('es-CL');
  }

  get totalActivo(): number { return this.pedidos.reduce((suma, p) => suma + (p.total || 0), 0); }

  get entregadasArchivo(): number {
    return this.archivoPedidos.filter(p => p.estado === 'Entregado' && !p.eliminado).length;
  }

  get ordenesSinFecha(): number { return this.pedidos.filter(p => !p.fechaCreacion).length; }

  // Vista del gráfico diario: cantidad de órdenes o monto vendido
  vistaDia: 'ordenes' | 'ventas' = 'ordenes';

  private compacto(valor: number): string {
    return '$' + new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);
  }

  get pedidosPorDia(): { etiqueta: string; texto: string; pct: number }[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias: { fecha: number; etiqueta: string; cantidad: number; monto: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      dias.push({ fecha: d.getTime(), etiqueta: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }), cantidad: 0, monto: 0 });
    }
    for (const p of this.ordenesConFecha()) {
      const f = new Date(p.fechaCreacion as string);
      f.setHours(0, 0, 0, 0);
      const dia = dias.find(x => x.fecha === f.getTime());
      if (dia) { dia.cantidad++; dia.monto += p.total || 0; }
    }
    const ventas = this.vistaDia === 'ventas';
    const maximo = Math.max(1, ...dias.map(d => (ventas ? d.monto : d.cantidad)));
    return dias.map(d => ({
      etiqueta: d.etiqueta,
      texto: ventas ? this.compacto(d.monto) : String(d.cantidad),
      pct: ((ventas ? d.monto : d.cantidad) / maximo) * 100
    }));
  }

  // ---------- Actualización automática del panel ----------
  ultimaActualizacion = '';
  private temporizadorPanel: ReturnType<typeof setInterval> | null = null;

  refrescarPanel(): void {
    this.obtenerPedidos();
    this.obtenerProductos();
    this.cargarArchivo();
    this.cargarCotizaciones();
    this.ultimaActualizacion = new Date().toLocaleTimeString('es-CL');
  }

  private iniciarRefrescoPanel(): void {
    this.detenerRefrescoPanel();
    this.refrescarPanel();
    this.temporizadorPanel = setInterval(() => {
      if (this.moduloActivo === 'INDICADORES' && !document.hidden) this.refrescarPanel();
    }, 20000);
  }

  private detenerRefrescoPanel(): void {
    if (this.temporizadorPanel) { clearInterval(this.temporizadorPanel); this.temporizadorPanel = null; }
  }

  ngOnDestroy(): void { this.detenerRefrescoPanel(); }

  // Últimos movimientos, armados con las fechas y responsables que registra el sistema
  get actividadReciente(): { fecha: number; texto: string; detalle: string }[] {
    const eventos: { fecha: number; texto: string; detalle: string }[] = [];
    const agregar = (fecha: string | undefined, texto: string, detalle: string) => {
      if (!fecha) return;
      const t = new Date(fecha).getTime();
      if (!isNaN(t)) eventos.push({ fecha: t, texto, detalle });
    };
    for (const p of [...this.pedidos, ...this.archivoPedidos]) {
      agregar(p.fechaCreacion, 'Orden ' + p.tracking + ' creada', p.cliente + (p.creadoPor ? ' · por ' + p.creadoPor : ''));
      agregar(p.fechaAceptacion, 'Cotización aceptada para la orden ' + p.tracking, p.aceptadaPor ? 'por ' + p.aceptadaPor : '');
      if (p.estado === 'Entregado' && !p.eliminado) agregar(p.fechaCierre, 'Orden ' + p.tracking + ' entregada', p.cliente);
      if (p.eliminado) agregar(p.fechaEliminacion, 'Orden ' + p.tracking + ' eliminada', p.eliminadoPor ? 'por ' + p.eliminadoPor : '');
    }
    for (const c of [...this.cotizaciones, ...this.archivoCotizaciones]) {
      agregar(c.fechaCreacion, 'Cotización #' + c.id + ' recibida', c.cliente);
      if (c.estado === 'RECHAZADA') agregar(c.fechaCierre, 'Cotización #' + c.id + ' rechazada', c.cliente);
      if (c.estado === 'CONVERTIDA') agregar(c.fechaCierre, 'Cotización #' + c.id + ' convertida en guía', c.pedidoTracking || '');
    }
    return eventos.sort((a, b) => b.fecha - a.fecha).slice(0, 10);
  }

  // ---------- Ventas y metas del mes ----------
  metaMensual = this.leerMeta();
  metaTemporal = '';
  private claveMeta = 'pedidos360_meta_mensual';

  private leerMeta(): number {
    try { return Number(localStorage.getItem('pedidos360_meta_mensual')) || 0; } catch { return 0; }
  }

  guardarMeta(): void {
    const valor = Math.round(Number(String(this.metaTemporal).replace(/[^0-9]/g, '')));
    this.metaMensual = valor > 0 ? valor : 0;
    try { localStorage.setItem(this.claveMeta, String(this.metaMensual)); } catch { /* sin almacenamiento local */ }
    this.metaTemporal = '';
  }

  // Todas las órdenes que no fueron eliminadas (activas y archivadas)
  private ordenesValidas(): Pedido[] {
    return [...this.pedidos, ...this.archivoPedidos.filter(p => !p.eliminado)];
  }

  private ordenesConFecha(): Pedido[] {
    return this.ordenesValidas().filter(p => !!p.fechaCreacion);
  }

  private esDelMes(fecha?: string): boolean {
    if (!fecha) return false;
    const f = new Date(fecha);
    const hoy = new Date();
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
  }

  get nombreMes(): string {
    return new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  get ventasMes(): number {
    return this.ordenesValidas().filter(p => this.esDelMes(p.fechaCreacion)).reduce((suma, p) => suma + (p.total || 0), 0);
  }

  get cumplidoMes(): number {
    return this.archivoPedidos
      .filter(p => p.estado === 'Entregado' && !p.eliminado && this.esDelMes(p.fechaCierre))
      .reduce((suma, p) => suma + (p.total || 0), 0);
  }

  get acumuladoHistorico(): number {
    return this.ordenesValidas().reduce((suma, p) => suma + (p.total || 0), 0);
  }

  get ticketPromedio(): number {
    const n = this.ordenesValidas().length;
    return n > 0 ? this.acumuladoHistorico / n : 0;
  }

  get cotizacionesPorCerrar(): { cantidad: number; monto: number } {
    const abiertas = this.cotizaciones.filter(c => c.estado === 'PENDIENTE' || c.estado === 'CONTACTADO' || c.estado === 'ACEPTADA');
    return { cantidad: abiertas.length, monto: abiertas.reduce((suma, c) => suma + (c.totalEst || 0), 0) };
  }

  get cumplimientoMeta(): number {
    return this.metaMensual > 0 ? Math.min(100, (this.ventasMes / this.metaMensual) * 100) : 0;
  }

  get faltaMeta(): number { return Math.max(0, this.metaMensual - this.ventasMes); }

  get diasRestantesMes(): number {
    const hoy = new Date();
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    return ultimo - hoy.getDate() + 1;
  }

  get ritmoNecesario(): number {
    return this.diasRestantesMes > 0 ? this.faltaMeta / this.diasRestantesMes : 0;
  }

  get embudoDespacho(): { nombre: string; valor: number; pct: number }[] {
    const etapas = [
      { nombre: 'En preparación', valor: this.getCount('En Preparacion') },
      { nombre: 'Listo para despacho', valor: this.getCount('Listo para Despacho') },
      { nombre: 'En tránsito', valor: this.getCount('En Transito') },
      { nombre: 'En reparto', valor: this.getCount('En Reparto') },
      { nombre: 'Entregado', valor: this.entregadasArchivo }
    ];
    const maximo = Math.max(1, ...etapas.map(e => e.valor));
    return etapas.map(e => ({ ...e, pct: (e.valor / maximo) * 100 }));
  }

  get distribucionCourier(): { nombre: string; cantidad: number; pct: number }[] {
    const mapa = new Map<string, number>();
    for (const p of this.pedidos) {
      const c = p.courier || 'Sin courier';
      mapa.set(c, (mapa.get(c) || 0) + 1);
    }
    const total = this.pedidos.length || 1;
    return Array.from(mapa.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, cantidad]) => ({ nombre, cantidad, pct: Math.round((cantidad / total) * 100) }));
  }

  get alertasStock(): Producto[] {
    return this.productos
      .filter(p => p.stock <= (p.stockMinimo || 0))
      .sort((a, b) => (a.stock - (a.stockMinimo || 0)) - (b.stock - (b.stockMinimo || 0)))
      .slice(0, 6);
  }

  get topClientes(): { nombre: string; monto: number; pct: number }[] {
    const mapa = new Map<string, number>();
    for (const p of this.pedidos) mapa.set(p.cliente, (mapa.get(p.cliente) || 0) + (p.total || 0));
    const lista = Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maximo = Math.max(1, ...lista.map(x => x[1]));
    return lista.map(([nombre, monto]) => ({ nombre, monto, pct: (monto / maximo) * 100 }));
  }

  // Unifica estados antiguos o escritos distinto (p. ej. datos de prueba) con los del flujo oficial
  private normalizarEstado(estado?: string): string {
    const clave = (estado || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    const mapa: Record<string, string> = {
      'pendiente': 'En Preparacion', 'en preparacion': 'En Preparacion', 'en preparación': 'En Preparacion',
      'listo para despacho': 'Listo para Despacho',
      'en ruta': 'En Transito', 'en transito': 'En Transito', 'en tránsito': 'En Transito',
      'en reparto': 'En Reparto', 'entregado': 'Entregado',
      'incidencia en ruta': 'Incidencia en Ruta', 'incidencia': 'Incidencia en Ruta'
    };
    return mapa[clave] || estado || 'En Preparacion';
  }

  etiquetaEstadoPedido(estado: string): string {
    const etiquetas: Record<string, string> = {
      'En Preparacion': 'En preparación', 'Listo para Despacho': 'Listo para despacho',
      'En Transito': 'En tránsito', 'En Reparto': 'En reparto',
      'Entregado': 'Entregado', 'Incidencia en Ruta': 'Incidencia en ruta'
    };
    return etiquetas[estado] || estado;
  }

  getCount(estado: string): number { return this.pedidos.filter(p => p.estado === estado).length; }
  getCountRuta(): number { return this.pedidos.filter(p => p.estado === 'En Transito' || p.estado === 'En Reparto').length; }
  getCountIncidencias(): number { return this.pedidos.filter(p => p.estado === 'Incidencia en Ruta' || (p.incidencia && p.incidencia.trim() !== '')).length; }
  getAlertasStockCount(): number { return this.productos.filter(p => p.stock <= p.stockMinimo).length; }

  cotizaciones: Cotizacion[] = [];
  mostrarModalCotizar = false;
  productoSeleccionadoParaCotizar: any = null;

  nuevaCotizacion = {
    cliente: '',
    email: '',
    region: '',
    comuna: '',
    cantidad: 1,
    comunasDisponiblesPublicas: [] as string[]
  };

  abrirModalCotizar(prod: any): void {
    this.ngZone.run(() => {
      this.productoSeleccionadoParaCotizar = prod;
      this.nuevaCotizacion = { cliente: '', email: '', region: '', comuna: '', cantidad: 1, comunasDisponiblesPublicas: [] };
      this.mostrarModalCotizar = true;
      this.cdr.detectChanges();
    });
  }

  cerrarModalCotizar(): void {
    this.ngZone.run(() => {
      this.mostrarModalCotizar = false;
      this.productoSeleccionadoParaCotizar = null;
      this.cdr.detectChanges();
    });
  }

  onRegionCotizacionChange(event: any): void {
    const reg = event.target.value;
    this.ngZone.run(() => {
      this.nuevaCotizacion.region = reg;
      this.nuevaCotizacion.comuna = '';
      if (reg === 'Metropolitana') {
        this.nuevaCotizacion.comunasDisponiblesPublicas = ['Santiago', 'Padre Hurtado', 'Colina (Chicureo)', 'Providencia', 'Las Condes', 'Maipú', 'Puente Alto'];
      } else if (reg === 'Valparaiso') {
        this.nuevaCotizacion.comunasDisponiblesPublicas = ['Valparaíso', 'Viña del Mar', 'Concón', 'Villa Alemana', 'Quilpué'];
      } else if (reg === 'OHiggins') {
        this.nuevaCotizacion.comunasDisponiblesPublicas = ['Rancagua', 'Machalí', 'San Fernando', 'Rengo'];
      } else {
        this.nuevaCotizacion.comunasDisponiblesPublicas = [];
      }
      this.cdr.detectChanges();
    });
  }

  // Las cotizaciones se guardan en el servidor: con fecha, historial y archivo
  // Evita enviar la misma cotización varias veces mientras el servidor responde
  enviandoCotizacion = false;

  enviarSolicitudCotizacion(): void {
    if (this.enviandoCotizacion) return;
    if (!this.nuevaCotizacion.cliente.trim() || !this.nuevaCotizacion.region || !this.nuevaCotizacion.comuna || !this.productoSeleccionadoParaCotizar) {
      alert('Por favor complete todos los campos obligatorios para la cotización.');
      return;
    }
    const cantidad = Number(this.nuevaCotizacion.cantidad);
    if (!cantidad || cantidad < 1) {
      alert('La cantidad debe ser al menos 1.');
      return;
    }

    const prod = this.productoSeleccionadoParaCotizar;
    const solicitud = {
      cliente: this.nuevaCotizacion.cliente.trim(),
      email: (this.nuevaCotizacion.email || '').trim(),
      producto: prod.nombre,
      productoId: prod.id,
      sku: prod.sku,
      cantidad,
      region: this.nuevaCotizacion.region,
      comuna: this.nuevaCotizacion.comuna,
      totalEst: prod.precio * cantidad
    };

    this.enviandoCotizacion = true;
    this.http.post<Cotizacion>(this.apiCotizacionesUrl, solicitud, this.opciones()).subscribe({
      next: (creada) => {
        this.ngZone.run(() => {
          this.enviandoCotizacion = false;
          if (this.sesionActiva) this.cotizaciones.unshift(creada);
          alert('Cotización enviada con éxito. El equipo comercial la revisará en la torre de control.');
          this.cerrarModalCotizar();
          this.cdr.detectChanges();
        });
      },
      error: (e: HttpErrorResponse) => {
        this.ngZone.run(() => {
          this.enviandoCotizacion = false;
          alert(e.status === 409
            ? (e.error?.mensaje ?? 'Ya existe una cotización igual en revisión.')
            : (e.error?.mensaje ?? 'No se pudo enviar la cotización. Intenta nuevamente en unos minutos.'));
          this.cdr.detectChanges();
        });
      }
    });
  }

  cargarCotizaciones(): void {
    this.http.get<Cotizacion[]>(this.apiCotizacionesUrl).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.cotizaciones = data ?? [];
          this.cdr.detectChanges();
        });
        this.importarCotizacionesDelNavegador();
      },
      error: (e) => console.warn('No se pudo cargar la bandeja de cotizaciones:', e)
    });
  }

  // Las cotizaciones que antes vivían solo en este navegador se suben una vez al servidor
  private importarCotizacionesDelNavegador(): void {
    const clave = 'cotizaciones_app_data';
    let locales: any[] = [];
    try { locales = JSON.parse(localStorage.getItem(clave) ?? '[]'); } catch { locales = []; }
    if (!Array.isArray(locales) || locales.length === 0) {
      localStorage.removeItem(clave);
      return;
    }
    const paquete = locales.map(c => ({
      cliente: c.cliente, email: c.email, producto: c.producto, cantidad: c.cantidad,
      region: c.region, comuna: c.comuna, totalEst: c.totalEst, estado: c.estado
    }));
    this.http.post<Cotizacion[]>(`${this.apiCotizacionesUrl}/importar`, paquete, this.opciones()).subscribe({
      next: () => {
        localStorage.removeItem(clave);
        this.cargarCotizaciones();
      },
      error: (e) => console.warn('No se pudieron importar las cotizaciones locales:', e)
    });
  }

  cambiarEstadoCotizacion(cot: Cotizacion, nuevoEstado: 'PENDIENTE' | 'CONTACTADO' | 'ACEPTADA' | 'RECHAZADA'): void {
    const anterior = cot.estado;
    this.ngZone.run(() => {
      cot.estado = nuevoEstado;
      this.cdr.detectChanges();
    });
    this.http.patch<Cotizacion>(`${this.apiCotizacionesUrl}/${cot.id}/estado`, { estado: nuevoEstado }, this.opciones()).subscribe({
      next: (actualizada) => {
        this.ngZone.run(() => {
          Object.assign(cot, actualizada);
          if (actualizada.estado === 'RECHAZADA') {
            this.cotizaciones = this.cotizaciones.filter(c => c.id !== cot.id);
            this.notificacionReciente = `Cotización de [${cot.cliente}] rechazada: pasó al Archivo.`;
          } else {
            this.notificacionReciente = `Cotización de [${cot.cliente}] actualizada a: ${nuevoEstado}`;
          }
          this.cdr.detectChanges();
        });
      },
      error: (e: HttpErrorResponse) => {
        this.ngZone.run(() => {
          cot.estado = anterior;
          alert(e.error?.mensaje ?? 'No se pudo actualizar la cotización en el servidor.');
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Ids de cotizaciones cuya guía se está generando (evita el doble clic)
  generandoGuia = new Set<number>();

  productoDeCotizacion(cot: Cotizacion): Producto | undefined {
    if (cot.productoId) {
      const porId = this.productos.find(p => p.id === cot.productoId);
      if (porId) return porId;
    }
    const nombre = cot.producto.toLowerCase();
    return this.productos.find(p => p.nombre.toLowerCase() === nombre)
      ?? this.productos.find(p => p.nombre.toLowerCase().includes(nombre) || nombre.includes(p.nombre.toLowerCase()));
  }

  // Aviso informativo en la bandeja; la revisión definitiva de stock la hace el servidor al generar la guía
  stockInsuficiente(cot: Cotizacion): boolean {
    const prod = this.productoDeCotizacion(cot);
    return !!prod && cot.cantidad > prod.stock;
  }

  // El servidor revisa el stock, lo descuenta, crea la guía y archiva la cotización en un solo paso
  convertirCotizacionEnPedido(cot: Cotizacion): void {
    if (cot.estado !== 'ACEPTADA') {
      alert('La cotización debe estar marcada como Aceptada por Cliente para generar la guía.');
      return;
    }
    if (this.generandoGuia.has(cot.id)) return;

    this.generandoGuia.add(cot.id);
    const liberar = () => {
      this.generandoGuia.delete(cot.id);
      this.cdr.detectChanges();
    };

    this.http.post<Pedido>(`${this.apiCotizacionesUrl}/${cot.id}/generar-guia`, { courier: 'Blue Express' }, this.opciones()).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          this.pedidos.unshift(this.normalizarPedido(creado));
          this.cotizaciones = this.cotizaciones.filter(c => c.id !== cot.id);
          this.guardarCacheLocal();
          this.obtenerProductos(); // trae el stock ya descontado
          this.notificacionReciente = `Guía ${creado.tracking} generada: stock descontado y cotización archivada.`;
          liberar();
        });
      },
      error: (e: HttpErrorResponse) => {
        this.ngZone.run(() => {
          if (e.status === 409) {
            alert(e.error?.mensaje ?? 'No se pudo generar la guía: revisa el stock de la cotización.');
            this.obtenerProductos();
            this.cargarCotizaciones();
          } else {
            console.error('Generar guía falló:', e);
            this.notificacionReciente = 'No se pudo generar la guía en el servidor';
          }
          liberar();
        });
      }
    });
  }

  // =================== ARCHIVO ===================
  archivoTab: 'COTIZACIONES' | 'ORDENES' = 'COTIZACIONES';
  archivoCotizaciones: Cotizacion[] = [];
  archivoPedidos: Pedido[] = [];
  archivoCargando = false;
  archivoError = '';
  filtroArchivoTexto = '';
  filtroArchivoEstado = 'TODOS';

  detalle: {
    tipo: 'COTIZACION' | 'PEDIDO';
    cotizacion?: Cotizacion;
    pedido?: Pedido;
    historial: EventoHistorial[];
    cargando: boolean;
    desdeArchivo: boolean;
  } | null = null;

  private etiquetasAccion: Record<string, string> = {
    CREADA: 'Creada',
    IMPORTADA: 'Importada desde el navegador',
    ACEPTADA: 'Aceptada por el administrador',
    RECHAZADA: 'Rechazada',
    ESTADO: 'Cambio de estado',
    CONVERTIDA: 'Convertida en guía',
    DEVUELTA: 'Devuelta a la bandeja',
    EDITADA: 'Datos editados',
    ENTREGADA: 'Entregada',
    INCIDENCIA: 'Incidencia registrada',
    INCIDENCIA_RESUELTA: 'Incidencia resuelta',
    ELIMINADA: 'Eliminada de Control de Órdenes'
  };

  etiquetaAccion(accion: string): string {
    return this.etiquetasAccion[accion] ?? accion;
  }

  etiquetaEstadoCotizacion(estado: string): string {
    const nombres: Record<string, string> = {
      PENDIENTE: 'Pendiente', CONTACTADO: 'Contactado', ACEPTADA: 'Aceptada',
      RECHAZADA: 'Rechazada', CONVERTIDA: 'Convertida en guía'
    };
    return nombres[estado] ?? estado;
  }

  estadoArchivoPedido(p: Pedido): string {
    return p.eliminado ? 'Eliminada' : p.estado;
  }

  seleccionarArchivoTab(tab: 'COTIZACIONES' | 'ORDENES'): void {
    this.ngZone.run(() => {
      this.archivoTab = tab;
      this.filtroArchivoEstado = 'TODOS';
      this.filtroArchivoTexto = '';
      this.cdr.detectChanges();
    });
  }

  cargarArchivo(): void {
    this.archivoCargando = true;
    this.archivoError = '';
    let pendientes = 2;
    const terminar = () => {
      pendientes--;
      if (pendientes === 0) {
        this.ngZone.run(() => {
          this.archivoCargando = false;
          this.cdr.detectChanges();
        });
      }
    };
    const fallo = (e: HttpErrorResponse) => {
      console.error('No se pudo cargar el archivo:', e);
      this.ngZone.run(() => {
        this.archivoError = 'No se pudo cargar el archivo desde el servidor. Intenta actualizar en unos minutos.';
        this.cdr.detectChanges();
      });
      terminar();
    };

    this.http.get<Cotizacion[]>(`${this.apiCotizacionesUrl}/archivo`).subscribe({
      next: (data) => { this.ngZone.run(() => { this.archivoCotizaciones = data ?? []; }); terminar(); },
      error: fallo
    });
    this.http.get<Pedido[]>(`${this.apiPedidosUrl}/archivo`).subscribe({
      next: (data) => { this.ngZone.run(() => { this.archivoPedidos = (data ?? []).map(p => this.normalizarPedido(p)); }); terminar(); },
      error: fallo
    });
  }

  private coincide(texto: string, ...campos: (string | number | undefined)[]): boolean {
    const t = texto.trim().toLowerCase();
    if (!t) return true;
    return campos.some(c => c !== undefined && String(c).toLowerCase().includes(t));
  }

  get archivoCotizacionesFiltradas(): Cotizacion[] {
    return this.archivoCotizaciones.filter(c =>
      (this.filtroArchivoEstado === 'TODOS' || c.estado === this.filtroArchivoEstado) &&
      this.coincide(this.filtroArchivoTexto, c.cliente, c.producto, c.pedidoTracking, c.comuna));
  }

  get archivoPedidosFiltrados(): Pedido[] {
    return this.archivoPedidos.filter(p =>
      (this.filtroArchivoEstado === 'TODOS' || this.estadoArchivoPedido(p) === this.filtroArchivoEstado) &&
      this.coincide(this.filtroArchivoTexto, p.cliente, p.producto, p.tracking, p.destino));
  }

  private abrirDetalle(base: { tipo: 'COTIZACION' | 'PEDIDO'; cotizacion?: Cotizacion; pedido?: Pedido }, id: number | undefined, desdeArchivo: boolean): void {
    this.ngZone.run(() => {
      this.detalle = { ...base, historial: [], cargando: true, desdeArchivo };
      this.cdr.detectChanges();
    });
    if (!id) {
      this.ngZone.run(() => { if (this.detalle) this.detalle.cargando = false; this.cdr.detectChanges(); });
      return;
    }
    const ruta = base.tipo === 'COTIZACION' ? this.apiCotizacionesUrl : this.apiPedidosUrl;
    this.http.get<EventoHistorial[]>(`${ruta}/${id}/historial`).subscribe({
      next: (eventos) => {
        this.ngZone.run(() => {
          if (this.detalle) { this.detalle.historial = eventos ?? []; this.detalle.cargando = false; }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          if (this.detalle) this.detalle.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  verDetalleCotizacion(cot: Cotizacion, desdeArchivo = false): void {
    this.abrirDetalle({ tipo: 'COTIZACION', cotizacion: cot }, cot.id, desdeArchivo);
  }

  verDetallePedido(p: Pedido, desdeArchivo = false): void {
    this.abrirDetalle({ tipo: 'PEDIDO', pedido: p }, p.id, desdeArchivo);
  }

  cerrarDetalle(): void {
    this.ngZone.run(() => {
      this.detalle = null;
      this.cdr.detectChanges();
    });
  }

  devolverCotizacion(cot: Cotizacion): void {
    if (cot.estado !== 'RECHAZADA') return;
    if (!confirm(`¿Devolver la cotización de ${cot.cliente} a la bandeja? Volverá como Pendiente.`)) return;
    this.http.post<Cotizacion>(`${this.apiCotizacionesUrl}/${cot.id}/devolver`, {}, this.opciones()).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.archivoCotizaciones = this.archivoCotizaciones.filter(c => c.id !== cot.id);
          this.detalle = null;
          this.notificacionReciente = `Cotización de [${cot.cliente}] devuelta a la bandeja.`;
          this.cdr.detectChanges();
        });
        this.cargarCotizaciones();
      },
      error: (e: HttpErrorResponse) => {
        this.ngZone.run(() => {
          alert(e.error?.mensaje ?? 'No se pudo devolver la cotización a la bandeja.');
          this.cdr.detectChanges();
        });
      }
    });
  }
}
