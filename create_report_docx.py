from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent
source = (ROOT / 'CourseGraph_DBMS_Report.md').read_text(encoding='utf-8').splitlines()

def run(text, bold=False, size=None):
    props = []
    if bold: props.append('<w:b/>')
    if size: props.append(f'<w:sz w:val="{size}"/>')
    p = f'<w:r><w:rPr>{"".join(props)}</w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
    return p

def para(text='', style=None, bold=False, size=None):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{ppr}{run(text, bold, size)}</w:p>'

def table(rows):
    out = ['<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>']
    for index, row in enumerate(rows):
        out.append('<w:tr>')
        for cell in row:
            text = cell.strip().replace('`', '')
            out.append('<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>')
            out.append(para(text, bold=index == 0))
            out.append('</w:tc>')
        out.append('</w:tr>')
    out.append('</w:tbl>')
    return ''.join(out)

body = []
i = 0
in_code = False
code_lines = []
while i < len(source):
    line = source[i]
    if line.startswith('```'):
        if in_code:
            body.append(para('\n'.join(code_lines), 'Code'))
            code_lines = []
            in_code = False
        else:
            in_code = True
        i += 1
        continue
    if in_code:
        code_lines.append(line)
        i += 1
        continue
    if line.startswith('|') and i + 1 < len(source) and source[i + 1].startswith('|'):
        rows = []
        while i < len(source) and source[i].startswith('|'):
            current = [x.strip() for x in source[i].strip('|').split('|')]
            if not all(set(x) <= {'-', ':'} for x in current): rows.append(current)
            i += 1
        body.append(table(rows))
        continue
    if line.startswith('# '):
        body.append(para(line[2:], 'Title'))
    elif line.startswith('## '):
        body.append(para(line[3:], 'Heading1'))
    elif line.startswith('### '):
        body.append(para(line[4:], 'Heading2'))
    elif line.startswith('- '):
        body.append(para(line[2:], 'ListBullet'))
    elif len(line) > 2 and line[0].isdigit() and '. ' in line[:4]:
        body.append(para(line.split('. ', 1)[1], 'ListNumber'))
    elif line.strip():
        body.append(para(line))
    else:
        body.append(para())
    i += 1

document = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>''' + ''.join(body) + '''<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>'''
styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/><w:fonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="1F4E79"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1F4E79"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="2F5597"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:fonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr></w:style></w:styles>'''
content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'''
rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/styles.xml"/></Relationships>'''
core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>CourseGraph DBMS Project Report</dc:title><dc:creator>Muralikrishnan Menon and Naivadh Srivatsav</dc:creator></cp:coreProperties>'''
out = ROOT / 'CourseGraph_DBMS_Report.docx'
with ZipFile(out, 'w', ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', document)
    z.writestr('word/styles.xml', styles)
    z.writestr('docProps/core.xml', core)
print(out)
