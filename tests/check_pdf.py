"""Revisar los PDF generados por web/tests/pdf-regression.ts (requiere pdfplumber)."""
from pathlib import Path
import json
import re
import pdfplumber

root=Path(__file__).resolve().parent/'artifacts'
results=[]
for path in (root/'pdf').glob('*.pdf'):
    with pdfplumber.open(path) as pdf:
        bad=[]
        for i,page in enumerate(pdf.pages):
            for c in page.chars:
                if c['x0'] < 40 or c['x1'] > 559 or c['top'] < 5 or c['bottom'] > 833:
                    bad.append({'page':i+1,'text':c['text'],'box':[c['x0'],c['top'],c['x1'],c['bottom']]})
        text='\n'.join(p.extract_text() or '' for p in pdf.pages)
        if path.stem=='long_description':
            # Se conservan las 149 líneas X de la descripción, además de la X del teléfono referencial.
            description_x=sum(line.strip()=='X' or line.strip() in ('PAS-002 X','CONT. X') for line in text.splitlines())
            assert description_x==149,(path.name,description_x)
            assert '\nZ\n' in '\n'+text+'\n'
        assert '(unknown)' not in text
        assert 'fotográfic' not in text
        if path.stem=='full_advance':
            left=' '.join(' '.join(p.crop((0,0,283,p.height)).extract_text().split()) for p in pdf.pages)
            assert 'No queda saldo pendiente' in left
        if path.stem=='long_headers':
            compact=re.sub(r'\s+','',text)
            assert ('PROYECTO'*17)[:120] in compact
            assert text.count('W')==120
            assert sum(line.strip()=='Nota' for line in text.splitlines())==310
            assert re.sub(r'\s+','',('ESPECIFICACIÓN PERSONALIZADA '*5)[:120]) in compact
        if path.stem=='test_project':
            assert len(pdf.pages)==1,'La cotización de prueba breve debe ocupar una página'
            compact=re.sub(r'\s+','',text)
            assert 'PRUEBA·AniversariodeValentina-mesadulceyregalos' in compact
            assert all(amount in text for amount in ['339.84','101.95','237.89'])
            assert 'Coordinar el horario de recojo.' in text
        if path.stem.startswith('redesign_'):
            assert len(pdf.pages)==1, 'La muestra del rediseño debe ocupar una página'
            assert all(amount in text for amount in ['339.84','169.92'])
            assert '50%' in text and 'Condiciones'.upper() in text
            assert '30/10/2026' in text and '+51 900000000' in text
            assert 'Valentina' in text and 'mini repostería' in text
            if path.stem=='redesign_usd':
                assert 'USD' in text and 'US$' in text and 'S/' not in text and 'PEN' not in text
            else:
                assert 'PEN' in text and 'S/' in text and 'USD' not in text
        if path.stem=='zero_total':
            assert 'no tiene importe a pagar' in text
        assert not bad,(path.name,bad[:3])
        results.append({'file':path.name,'pages':len(pdf.pages),'out_of_page':len(bad)})
(root/'pdf-layout.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
