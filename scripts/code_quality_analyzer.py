import subprocess
import sys
import os
import json
import time
from datetime import datetime

class CodeQualityAnalyzer:
    def __init__(self):
        self.results = {}
        self.start_time = time.time()
        self.colors = {
            'HEADER': '\033[95m',
            'OKBLUE': '\033[94m',
            'OKCYAN': '\033[96m',
            'OKGREEN': '\033[92m',
            'WARNING': '\033[93m',
            'FAIL': '\033[91m',
            'ENDC': '\033[0m',
            'BOLD': '\033[1m',
            'UNDERLINE': '\033[4m'
        }

    def print_status(self, message, status='info'):
        color = self.colors.get('OKBLUE', '')
        if status == 'success':
            color = self.colors.get('OKGREEN', '')
        elif status == 'error':
            color = self.colors.get('FAIL', '')
        elif status == 'warning':
            color = self.colors.get('WARNING', '')
        
        print(f"{color}{message}{self.colors.get('ENDC', '')}")

    def run_command(self, name, command):
        self.print_status(f"\n[+] Ejecutando {name}...", 'info')
        try:
            # Usar shell=True para comandos de pnpm en Windows
            process = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True
            )
            
            success = process.returncode == 0
            self.results[name] = {
                'success': success,
                'output': process.stdout,
                'error': process.stderr,
                'exit_code': process.returncode
            }
            
            if success:
                self.print_status(f"  OK: {name} completado con éxito.", 'success')
            else:
                self.print_status(f"  AVISO: {name} reportó problemas o falló (Exit Code: {process.returncode}).", 'warning')
        except Exception as e:
            self.print_status(f"  ERROR al ejecutar {name}: {str(e)}", 'error')
            self.results[name] = {'success': False, 'error': str(e)}

    def analyze(self):
        print(f"{self.colors['HEADER']}{self.colors['BOLD']}Analizador de Calidad de Código - Mesa Soporte Técnico{self.colors['ENDC']}")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        # 1. Linting
        self.run_command('ESLint', 'pnpm lint')

        # 2. Testing (Solo una ejecución rápida para verificar integridad)
        self.run_command('Vitest', 'pnpm test:all')

        # 3. Auditoría de dependencias
        self.run_command('Security Audit', 'pnpm audit')

        self.generate_report()

    def generate_report(self):
        total_time = time.time() - self.start_time
        print(f"\n{self.colors['BOLD']}--- INFORME RESUMIDO ---{self.colors['ENDC']}")
        
        passed_count = sum(1 for r in self.results.values() if r.get('success'))
        total_count = len(self.results)
        
        for name, data in self.results.items():
            status = f"{self.colors['OKGREEN']}PASO{self.colors['ENDC']}" if data.get('success') else f"{self.colors['FAIL']}FALLO{self.colors['ENDC']}"
            print(f"- {name:<20} [{status}]")

        score = (passed_count / total_count) * 100 if total_count > 0 else 0
        
        print(f"\nScore de Calidad: {self.colors['BOLD']}{score:.2f}/100{self.colors['ENDC']}")
        print(f"Tiempo Total: {total_time:.2f}s")

        if score < 100:
            print(f"\n{self.colors['WARNING']}Revisa los detalles arriba para corregir los problemas encontrados.{self.colors['ENDC']}")
        else:
            print(f"\n{self.colors['OKGREEN']}¡Excelente! El código cumple con todos los estándares actuales.{self.colors['ENDC']}")

if __name__ == "__main__":
    analyzer = CodeQualityAnalyzer()
    analyzer.analyze()
