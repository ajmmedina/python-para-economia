import yaml
import json
import os
from pathlib import Path

# CONFIGURACIÓN
USER = "ajmmedina"
REPO = "python-para-economia"
BRANCH = "main"

def procesar_catalogo():
    # root_notebook = Path("..") / "notebooks"
    root_notebook = Path("notebooks")
    raw_base_url = f"https://raw.githubusercontent.com/{USER}/{REPO}/{BRANCH}/"
    data = {"unidades": []}
    
    # 1. Listar archivos unidad_*.yaml
    archivos_unidad = sorted([f for f in os.listdir(root_notebook) if f.startswith('unidad_') and f.endswith('.yaml')])

    for archivo_u in archivos_unidad:
        with open(os.path.join(root_notebook, archivo_u), 'r', encoding='utf-8') as f:
            u_meta = yaml.safe_load(f)
        
        # Solo tomamos campos públicos de la unidad
        unidad_item = {
            "unidad": u_meta.get("unidad"),
            "titulo": u_meta.get("titulo"),
            "descripcion": u_meta.get("descripcion"),
            "objetivo": u_meta.get("objetivo"),
            "sesiones": [],
            "proyectos": []
        }

        # 2. Procesar Subcarpetas
        for tipo in ['sesiones', 'proyectos']:
            folder_path = os.path.join(root_notebook, tipo)
            if not os.path.exists(folder_path): continue

            for f_name in sorted(os.listdir(folder_path)):
                if f_name.endswith('.yaml'):
                    with open(os.path.join(folder_path, f_name), 'r', encoding='utf-8') as yf:
                        meta = yaml.safe_load(yf)
                    
                    if meta.get('unidad') == unidad_item['unidad']:
                        # Construir ruta al .ipynb en la rama main
                        rel_path = f"{root_notebook.name}/{tipo}/{f_name.replace('.yaml', '.ipynb')}"
                        
                        # Limpieza de metadatos (Solo lo necesario para el HTML)
                        item_limpio = {
                            "titulo": meta.get("titulo"),
                            "descripcion": meta.get("descripcion"),
                            "proposito": meta.get("proposito"),
                            "dificultad": meta.get("dificultad"),
                            "librerias": meta.get("librerias"),
                            "raw_url": f"{raw_base_url}{rel_path}",
                            "colab_url": f"https://colab.research.google.com/github/{USER}/{REPO}/blob/{BRANCH}/{rel_path}"
                        }
                        
                        key = 'sesiones' if tipo == 'sesiones' else 'proyectos'
                        unidad_item[key].append(item_limpio)
        
        data['unidades'].append(unidad_item)

    # 3. Guardar en carpeta site/assets/data
    # root_data = Path('..') / 'site' / 'assets' / 'data'
    root_data = Path('site') / 'assets' / 'data'
    os.makedirs(root_data, exist_ok=True)
    with open(root_data / 'catalog.json', 'w', encoding='utf-8') as jf:
        json.dump(data, jf, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    procesar_catalogo()