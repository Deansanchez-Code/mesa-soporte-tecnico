import os
import sys
import argparse
from pathlib import Path

def setup_args():
    parser = argparse.ArgumentParser(description='Andamiador de características para Mesa Soporte Técnico')
    parser.add_argument('target', help='Nombre de la característica o ruta completa')
    parser.add_argument('--verbose', action='store_true', help='Muestra detalles del proceso')
    return parser.parse_args()

def create_boilerplate(parent_dir, feature_name, verbose=False):
    base_path = Path(parent_dir)
    
    # Determinar si el target es un nombre o una ruta
    if not os.path.isabs(base_path) and len(base_path.parts) == 1:
        # Asumir que es una característica en src/features
        feature_path = Path('src/features') / base_path
    else:
        feature_path = base_path

    if feature_path.exists():
        print(f"Error: La ruta '{feature_path}' ya existe.")
        return False

    subdirs = ['actions', 'components', 'hooks', 'services', 'types']
    
    try:
        if verbose:
            print(f"[*] Creando estructura para: {feature_path}")

        os.makedirs(feature_path, exist_ok=True)
        
        for subdir in subdirs:
            path = feature_path / subdir
            os.makedirs(path, exist_ok=True)
            if verbose:
                print(f"  [+] Directorio creado: {path}")

            # Crear un index.ts básico en cada subdirectorio
            index_file = path / 'index.ts'
            with open(index_file, 'w', encoding='utf-8') as f:
                f.write(f"// Index for {subdir}\nexport {{}};\n")
            if verbose:
                print(f"  [+] Archivo creado: {index_file}")

        # Crear un archivo de esquema básico si es una característica estándar
        schema_file = feature_path / 'schemas.ts'
        with open(schema_file, 'w', encoding='utf-8') as f:
            f.write("import { z } from 'zod';\n\nexport const baseSchema = z.object({\n  id: z.string().uuid(),\n  created_at: z.string().datetime(),\n});\n")
        
        print(f"\n[OK] Estructura de la característica '{feature_path.name}' creada exitosamente en {feature_path}")
        return True

    except Exception as e:
        print(f"Error fatal durante el andamiaje: {str(e)}")
        return False

if __name__ == "__main__":
    args = setup_args()
    success = create_boilerplate(args.target, args.target, args.verbose)
    if not success:
        sys.exit(1)
