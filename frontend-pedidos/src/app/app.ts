import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
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
  producto: string;
  cantidad: number;
  region: string;
  comuna: string;
  totalEst: number;
  fecha: string;
  estado: 'PENDIENTE' | 'CONTACTADO' | 'ACEPTADA' | 'RECHAZADA';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  public auth = inject(AuthService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  moduloActivo: 'PEDIDOS' | 'PRODUCTOS' | 'COTIZACIONES' = 'PEDIDOS';

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
    this.cargarCacheCotizaciones();
    this.obtenerPedidos();
    this.obtenerProductos();

    // Diagnóstico en consola para capturar errores de Auth0
    this.auth.error$.subscribe(err => {
      console.error('ERROR DE AUTH0:', err);
    });

    this.auth.isAuthenticated$.subscribe(autenticado => {
      console.log('¿Estado de autenticación?:', autenticado);
      // Al iniciar sesión se vuelve a pedir el catálogo, ahora con el token
      if (autenticado) this.obtenerProductos();
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

  cambiarModulo(modulo: 'PEDIDOS' | 'PRODUCTOS' | 'COTIZACIONES'): void {
    this.ngZone.run(() => {
      this.moduloActivo = modulo;
      this.cdr.detectChanges();
    });
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

    this.http.post<Pedido>(this.apiPedidosUrl, editado).subscribe({
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

    this.http.patch<Pedido>(`${this.apiPedidosUrl}/${id}/incidencia`, { incidencia: motivo }).subscribe({
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
          if (data && data.length > 0) {
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
      estado: p.estado || 'En Preparacion',
      incidencia: p.incidencia || ''
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

    this.http.post<Pedido>(this.apiPedidosUrl, payload).subscribe({
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
    this.ngZone.run(() => {
      pedido.estado = nuevoEstado;
      this.cdr.detectChanges();
    });
    this.http.patch(`${this.apiPedidosUrl}/${pedido.id}/estado`, { estado: nuevoEstado }).subscribe();
  }

  eliminarPedido(id: number | undefined, tracking: string): void {
    if (!id || this.rolSeleccionado !== 'ADMIN') return;
    if (confirm(`Confirma ejercicio del Derecho de Supresión ARCO para la guía ${tracking}`)) {
      this.http.delete(`${this.apiPedidosUrl}/${id}`).subscribe({
        next: () => this.removerLocal(id, tracking),
        error: () => this.removerLocal(id, tracking)
      });
    }
  }

  private removerLocal(id: number, tracking: string): void {
    this.ngZone.run(() => {
      this.pedidos = this.pedidos.filter(p => p.id !== id);
      this.notificacionReciente = `Registro suprimido (ARCO): ${tracking}`;
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

  enviarSolicitudCotizacion(): void {
    if (!this.nuevaCotizacion.cliente.trim() || !this.nuevaCotizacion.region || !this.nuevaCotizacion.comuna || !this.productoSeleccionadoParaCotizar) {
      alert('Por favor complete todos los campos obligatorios para la cotizacion.');
      return;
    }

    const subtotal = this.productoSeleccionadoParaCotizar.precio * this.nuevaCotizacion.cantidad;
    const nuevaCot: Cotizacion = {
      id: Date.now(),
      cliente: this.nuevaCotizacion.cliente.trim(),
      producto: this.productoSeleccionadoParaCotizar.nombre,
      cantidad: Number(this.nuevaCotizacion.cantidad),
      region: this.nuevaCotizacion.region,
      comuna: this.nuevaCotizacion.comuna,
      totalEst: subtotal,
      fecha: new Date().toLocaleDateString(),
      estado: 'PENDIENTE'
    };

    this.ngZone.run(() => {
      this.cotizaciones.unshift(nuevaCot);
      localStorage.setItem('cotizaciones_app_data', JSON.stringify(this.cotizaciones));
      alert('Cotizacion enviada con exito. El equipo comercial la revisara en la torre de control.');
      this.cerrarModalCotizar();
      this.cdr.detectChanges();
    });
  }

  cambiarEstadoCotizacion(cot: Cotizacion, nuevoEstado: 'PENDIENTE' | 'CONTACTADO' | 'ACEPTADA' | 'RECHAZADA'): void {
    this.ngZone.run(() => {
      cot.estado = nuevoEstado;
      localStorage.setItem('cotizaciones_app_data', JSON.stringify(this.cotizaciones));
      this.notificacionReciente = `Cotizacion de [${cot.cliente}] actualizada a: ${nuevoEstado}`;
      this.cdr.detectChanges();
    });
  }
  // Ids de cotizaciones cuya guía se está generando (evita el doble clic)
  generandoGuia = new Set<number>();

  productoDeCotizacion(cot: Cotizacion): Producto | undefined {
    const nombre = cot.producto.toLowerCase();
    return this.productos.find(p => p.nombre.toLowerCase() === nombre)
      ?? this.productos.find(p => p.nombre.toLowerCase().includes(nombre) || nombre.includes(p.nombre.toLowerCase()));
  }

  stockInsuficiente(cot: Cotizacion): boolean {
    const prod = this.productoDeCotizacion(cot);
    return !!prod && cot.cantidad > prod.stock;
  }

  guardarCacheCotizaciones(): void {
    localStorage.setItem('cotizaciones_app_data', JSON.stringify(this.cotizaciones));
  }

  convertirCotizacionEnPedido(cot: Cotizacion): void {
    if (cot.estado !== 'ACEPTADA') {
      alert('La cotización debe estar marcada como Aceptada por Cliente para generar la guía.');
      return;
    }
    if (this.generandoGuia.has(cot.id)) return;

    const prod = this.productoDeCotizacion(cot);
    if (prod && cot.cantidad > prod.stock) {
      alert(`Alerta de stock insuficiente. Stock disponible: ${prod.stock} unidades. Se intentaron procesar ${cot.cantidad} unidades para "${prod.nombre}".`);
      return;
    }

    this.generandoGuia.add(cot.id);
    const descuentaEnServidor = !!prod && !!prod.id && this.catalogoDesdeServidor;
    const stockAnterior = prod ? prod.stock : 0;

    const liberar = () => {
      this.generandoGuia.delete(cot.id);
      this.cdr.detectChanges();
    };

    const crearPedido = () => {
      const payload: Pedido = {
        tracking: `TRK-CL-${Math.floor(1000 + Math.random() * 9000)}`,
        cliente: cot.cliente,
        producto: `${cot.cantidad}x ${cot.producto}`,
        cantidad: cot.cantidad,
        total: cot.totalEst,
        courier: 'Blue Express',
        destino: `${cot.comuna}, ${cot.region}`,
        estado: 'En Preparacion'
      };

      this.http.post<Pedido>(this.apiPedidosUrl, payload).subscribe({
        next: (creado) => {
          this.ngZone.run(() => {
            this.pedidos.unshift(this.normalizarPedido(creado));
            if (prod && !descuentaEnServidor) {
              prod.stock = Math.max(0, prod.stock - cot.cantidad);
            }
            // La cotización ya fue convertida: sale de la bandeja
            this.cotizaciones = this.cotizaciones.filter(c => c.id !== cot.id);
            this.guardarCacheCotizaciones();
            this.guardarCacheLocal();
            this.notificacionReciente = `Guía ${payload.tracking} generada para bodega a partir de la cotización.`;
            liberar();
          });
        },
        error: (e) => {
          console.error('POST pedido desde cotización falló:', e);
          this.ngZone.run(() => {
            this.notificacionReciente = 'No se pudo generar la guía en el servidor';
            if (prod && descuentaEnServidor) {
              // Se devuelve el stock que ya se había descontado
              prod.stock = stockAnterior;
              this.http.patch(`${this.apiProductosUrl}/${prod.id}/stock`, { stock: stockAnterior }).subscribe({ error: () => this.obtenerProductos() });
            }
            liberar();
          });
        }
      });
    };

    if (prod && descuentaEnServidor) {
      // El servidor revisa y descuenta el stock de una sola vez; si no alcanza responde 409
      this.http.post<any>(`${this.apiProductosUrl}/${prod.id}/descontar`, { cantidad: cot.cantidad }).subscribe({
        next: (actualizado) => {
          this.ngZone.run(() => {
            prod.stock = Number(actualizado.stockActual ?? actualizado.stock ?? prod.stock - cot.cantidad);
            crearPedido();
          });
        },
        error: (e: HttpErrorResponse) => {
          this.ngZone.run(() => {
            if (e.status === 409) {
              alert(e.error?.mensaje ?? 'Stock insuficiente para generar la guía.');
            } else {
              console.error('POST descontar stock falló:', e);
              this.notificacionReciente = 'No se pudo reservar el stock en el servidor';
            }
            this.obtenerProductos();
            liberar();
          });
        }
      });
    } else {
      crearPedido();
    }
  }

  cargarCacheCotizaciones(): void {
    const cache = localStorage.getItem('cotizaciones_app_data');
    if (cache) this.cotizaciones = JSON.parse(cache);
  }
}