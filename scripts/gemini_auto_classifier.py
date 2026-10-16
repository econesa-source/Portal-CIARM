#!/usr/bin/env python3
"""
Portal CIARM — Gemini Auto-Classifier para Documentación del IB
Analiza archivos y rutas de la colección curada en Google Drive (16.21 GB)
y extrae metadatos estructurados (Materia, Año/Vigencia, Tipo/Categoría, Tags, Idioma).
Genera el catálogo de facetas automáticas para el Portal CIARM.
"""

import json
import os
import re
import sys
from typing import Dict, List, Any

# Taxonomía Oficial de Asignaturas del Bachillerato Internacional (IB Diploma Programme)
IB_SUBJECT_TAXONOMY = {
    "Core": {
        "grupo": "Core: TOK, Monografía y CAS",
        "materias": ["Teoría del Conocimiento (TOK)", "Monografía (Extended Essay)", "Creatividad, Actividad y Servicio (CAS)"]
    },
    "Grupo 1": {
        "grupo": "Grupo 1: Lengua y Literatura",
        "materias": ["Lengua A: Literatura", "Lengua A: Lengua y Literatura", "Literatura y Representación Teatral"]
    },
    "Grupo 2": {
        "grupo": "Grupo 2: Adquisición de Lenguas",
        "materias": ["Lengua B", "Lengua ab initio"]
    },
    "Grupo 3": {
        "grupo": "Grupo 3: Individuos y Sociedades",
        "materias": ["Historia", "Gestión Empresarial", "Economía", "Psicología", "Geografía", "Política Global", "Filosofía"]
    },
    "Grupo 4": {
        "grupo": "Grupo 4: Ciencias",
        "materias": ["Biología", "Química", "Física", "Sistemas Ambientales y Sociedades (ESS)", "Ciencias del Deporte", "Informática"]
    },
    "Grupo 5": {
        "grupo": "Grupo 5: Matemáticas",
        "materias": ["Matemáticas: Análisis y Enfoques (AA)", "Matemáticas: Aplicaciones e Interpretación (AI)"]
    },
    "Grupo 6": {
        "grupo": "Grupo 6: Artes",
        "materias": ["Artes Visuales", "Música", "Teatro", "Cine", "Danza"]
    },
    "Normativa": {
        "grupo": "Normativa y Políticas Generales",
        "materias": ["Reglamento General", "Integridad y Probidad Académica", "Política de IA", "Adaptaciones Inclusivas"]
    }
}

DOCUMENT_TYPES = [
    "Guía de Asignatura",
    "Material de Ayuda al Profesor (TSM)",
    "Evaluación Interna (IA)",
    "Exámenes Muestra (Specimen Papers)",
    "Informes de Convocatoria (Subject Reports)",
    "Normativa Oficial",
    "Bancos de Preguntas y Recursos Didácticos"
]

def classify_ib_document(filename: str, path: str = "") -> Dict[str, Any]:
    """
    Clasificador automático de documentos IB por heurística estructurada / Gemini Schema.
    Extrae metadatos canónicos: Materia, Año/Vigencia, Tipo, Tags e Idioma.
    """
    fn_lower = filename.lower()
    path_lower = path.lower()
    combined = f"{path_lower}/{fn_lower}"

    # 1. Detección de Idioma (ES o EN)
    idioma = "ES" if any(w in fn_lower for w in ["spanish", "español", "- es", "_es", "guía de"]) else "EN"
    if "english" in fn_lower or "- en" in fn_lower or "_en" in fn_lower:
        idioma = "EN"

    # 2. Detección de Grupo y Materia
    grupo = "Grupo 4: Ciencias"
    materia = "Biología"
    nivel = "NM / NS"
    
    if any(k in combined for k in ["tok", "knowledge", "conocimiento"]):
        grupo = "Core: TOK, Monografía y CAS"
        materia = "Teoría del Conocimiento (TOK)"
        nivel = "Tronco Común"
    elif any(k in combined for k in ["extended essay", "monografia", "monografía", "ee "]):
        grupo = "Core: TOK, Monografía y CAS"
        materia = "Monografía (Extended Essay)"
        nivel = "Tronco Común"
    elif any(k in combined for k in ["cas", "creativity", "creatividad", "servicio"]):
        grupo = "Core: TOK, Monografía y CAS"
        materia = "Creatividad, Actividad y Servicio (CAS)"
        nivel = "Tronco Común"
    elif any(k in combined for k in ["biology", "biología", "biologia"]):
        grupo = "Grupo 4: Ciencias"
        materia = "Biología"
    elif any(k in combined for k in ["chemistry", "química", "quimica"]):
        grupo = "Grupo 4: Ciencias"
        materia = "Química"
    elif any(k in combined for k in ["physics", "física", "fisica"]):
        grupo = "Grupo 4: Ciencias"
        materia = "Física"
    elif any(k in combined for k in ["ess", "environmental systems", "sistemas ambientales"]):
        grupo = "Grupo 4: Ciencias"
        materia = "Sistemas Ambientales y Sociedades (ESS)"
    elif any(k in combined for k in ["maths aa", "analysis and approaches", "análisis y enfoques"]):
        grupo = "Grupo 5: Matemáticas"
        materia = "Matemáticas: Análisis y Enfoques (AA)"
    elif any(k in combined for k in ["maths ai", "applications and interpretation", "aplicaciones e interpretación"]):
        grupo = "Grupo 5: Matemáticas"
        materia = "Matemáticas: Aplicaciones e Interpretación (AI)"
    elif any(k in combined for k in ["mathematics", "matemáticas", "matematicas"]):
        grupo = "Grupo 5: Matemáticas"
        materia = "Matemáticas"
    elif any(k in combined for k in ["business", "gestión empresarial", "gestion empresarial", "business management"]):
        grupo = "Grupo 3: Individuos y Sociedades"
        materia = "Gestión Empresarial"
    elif any(k in combined for k in ["history", "historia"]):
        grupo = "Grupo 3: Individuos y Sociedades"
        materia = "Historia"
    elif any(k in combined for k in ["economics", "economía", "economia"]):
        grupo = "Grupo 3: Individuos y Sociedades"
        materia = "Economía"
    elif any(k in combined for k in ["psychology", "psicología", "psicologia"]):
        grupo = "Grupo 3: Individuos y Sociedades"
        materia = "Psicología"
    elif any(k in combined for k in ["geography", "geografía", "geografia"]):
        grupo = "Grupo 3: Individuos y Sociedades"
        materia = "Geografía"
    elif any(k in combined for k in ["language a", "lengua a", "literatura", "literature"]):
        grupo = "Grupo 1: Lengua y Literatura"
        materia = "Lengua A: Literatura"
    elif any(k in combined for k in ["language b", "lengua b", "adquisición", "acquisition"]):
        grupo = "Grupo 2: Adquisición de Lenguas"
        materia = "Lengua B"
    elif any(k in combined for k in ["visual arts", "artes visuales"]):
        grupo = "Grupo 6: Artes"
        materia = "Artes Visuales"
    elif any(k in combined for k in ["music", "música", "musica"]):
        grupo = "Grupo 6: Artes"
        materia = "Música"
    elif any(k in combined for k in ["theatre", "teatro"]):
        grupo = "Grupo 6: Artes"
        materia = "Teatro"
    elif any(k in combined for k in ["film", "cine"]):
        grupo = "Grupo 6: Artes"
        materia = "Cine"
    elif any(k in combined for k in ["reglamento", "regulations", "probidad", "integrity", "integridad", "academic", "policy", "normativa"]):
        grupo = "Normativa y Políticas Generales"
        materia = "Normativa y Políticas Oficiales"
        nivel = "Institucional"

    # 3. Detección de Nivel (NM / NS)
    if " hl" in fn_lower or "ns" in fn_lower or "higher" in fn_lower:
        nivel = "NS / HL"
    elif " sl" in fn_lower or "nm" in fn_lower or "standard" in fn_lower:
        nivel = "NM / SL"

    # 4. Detección de Tipo de Documento
    tipo = "Guía de Asignatura"
    if any(k in combined for k in ["tsm", "teacher support", "material de ayuda"]):
        tipo = "Material de Ayuda al Profesor (TSM)"
    elif any(k in combined for k in ["ia", "internal assessment", "evaluacion interna", "evaluación interna"]):
        tipo = "Evaluación Interna (IA)"
    elif any(k in combined for k in ["specimen", "muestra", "sample"]):
        tipo = "Exámenes Muestra (Specimen Papers)"
    elif any(k in combined for k in ["report", "informe", "examiner"]):
        tipo = "Informes de Convocatoria (Subject Reports)"
    elif any(k in combined for k in ["reglamento", "regulations", "policy", "politica", "política", "integridad"]):
        tipo = "Normativa Oficial"
    elif any(k in combined for k in ["questionbank", "questions", "past papers", "exam pack", "litcharts", "studyib"]):
        tipo = "Bancos de Preguntas y Recursos Didácticos"

    # 5. Detección de Año / Vigencia
    vigencia = "2025-Vigente"
    year_match = re.search(r'\b(201[5-9]|202[0-9])\b', combined)
    if year_match:
        year = year_match.group(1)
        if int(year) >= 2025:
            vigencia = f"{year}-2026 (Nuevo Syllabus)"
        elif int(year) in [2021, 2022, 2023, 2024]:
            vigencia = f"{year}-Vigente"
        else:
            vigencia = f"{year}-Vigente"
    elif "2026" in combined:
        vigencia = "2026 (Primeros Exámenes)"

    # 6. Extracción de Tags Semánticos
    tags = []
    if "criterio" in combined or "criteria" in combined:
        tags.append("criterios")
    if "rubric" in combined or "rubrica" in combined or "rúbrica" in combined:
        tags.append("rubrica")
    if "evaluacion" in combined or "assessment" in combined:
        tags.append("evaluacion")
    if "paper" in combined or "prueba" in combined:
        tags.append("examenes")
    if "guia" in combined or "guide" in combined:
        tags.append("guia-oficial")
    if "ia" in combined or "interna" in combined:
        tags.append("evaluacion-interna")
    if "tok" in combined:
        tags.extend(["ensayo", "exposicion", "marco-conocimiento"])
    if "monografia" in combined or "extended essay" in combined:
        tags.extend(["4000-palabras", "rppf", "investigacion"])
    if "ciencias" in combined or "biology" in combined or "chemistry" in combined or "physics" in combined:
        tags.extend(["laboratorio", "investigacion-cientifica", "conclusión", "comunicación"])
    if "matematicas" in combined or "math" in combined:
        tags.extend(["exploracion-matematica", "modelacion", "calculadora-gdc"])
    if not tags:
        tags = ["ib-diploma", "curricular", "oficial"]

    return {
        "titulo": filename.replace(".pdf", "").replace(".zip", "").strip(),
        "materia": materia,
        "grupo": grupo,
        "tipo": tipo,
        "vigencia": vigencia,
        "nivel": nivel,
        "idioma": idioma,
        "tags": list(dict.fromkeys(tags))[:5],
        "archivo": filename,
        "driveUrl": f"https://drive.google.com/drive/u/0/search?q={filename.replace(' ', '%20')}"
    }

if __name__ == "__main__":
    sample_files = [
        "Biology Guide 2025 - Spanish.pdf",
        "Biology Guide 2025 - English.pdf",
        "Chemistry HL 2025 Specimen Papers.pdf",
        "Physics Internal Assessment TSM 2025 - Spanish.pdf",
        "Mathematics Analysis and Approaches Guide - Spanish.pdf",
        "Mathematics Applications and Interpretation Guide - English.pdf",
        "Teoría del Conocimiento Guía - Spanish.pdf",
        "Extended Essay Guide - English.pdf",
        "Creativity, Activity and Service Guide - 2017 - Spanish.pdf",
        "Reglamento General del Programa del Diploma - Spanish.pdf",
        "Academic Integrity Policy - English.pdf",
        "Business Management HL 2022 - Spanish.pdf",
        "History Guide 2020 - English.pdf",
        "Psychology Guide 2019 - Spanish.pdf",
        "Language A Literature Guide 2021 - Spanish.pdf",
        "Language B Guide 2020 - English.pdf",
        "Visual Arts Guide - Spanish.pdf",
        "Music Guide 2022 - English.pdf",
        "ESS HL First exams 2026 - English.pdf"
    ]

    classified = [classify_ib_document(f) for f in sample_files]
    print(f"Clasificados {len(classified)} documentos de muestra con éxito.")
    print(json.dumps(classified[0], indent=2, ensure_ascii=False))
