import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Pedido {
  id?: number;
  tracking?: string;
  cliente: string;
  producto: string;
  cantidad: number;
  total: number;
  courier: string;
  destino: string;
  estado?: string;
  incidencia?: string;
}

export interface MetricasDashboard {
  totalPedidos: number;
  pendientes: number;
  enRuta: number;
  entregados: number;
  conIncidencias: number;
  alertasStock: number;
}

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  private http = inject(HttpClient);
  // Usa localhost si pruebas en tu máquina, o tu URL de Azure App Service si ya corre en la nube
  private apiUrl = 'http://localhost:8080/api';

  getMetricas(): Observable<MetricasDashboard> {
    return this.http.get<MetricasDashboard>(`${this.apiUrl}/reportes/metricas`);
  }

  getPedidos(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(`${this.apiUrl}/pedidos`);
  }

  actualizarEstado(id: number, estado: string, courier?: string): Observable<Pedido> {
    return this.http.patch<Pedido>(`${this.apiUrl}/pedidos/${id}/estado`, { estado, courier });
  }

  reportarIncidencia(id: number, descripcion: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.apiUrl}/pedidos/${id}/incidencias`, { descripcion });
  }
}