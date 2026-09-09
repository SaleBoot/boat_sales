#!/usr/bin/env python3
import io
import json
import os
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


FONT = 'NotoSansSC'
FONT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'fonts', 'NotoSansSC.ttf')
pdfmetrics.registerFont(TTFont(FONT, FONT_PATH))


def money(value):
    return '¥{:,.2f}'.format(float(value or 0))


def text(value, fallback='—'):
    value = '' if value is None else str(value).strip()
    return value or fallback


def build(order):
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    normal = ParagraphStyle('cn', parent=styles['Normal'], fontName=FONT, fontSize=9.5, leading=15, textColor=colors.HexColor('#344054'))
    small = ParagraphStyle('small', parent=normal, fontSize=8, leading=12, textColor=colors.HexColor('#667085'))
    title = ParagraphStyle('title', parent=normal, fontSize=22, leading=30, alignment=TA_CENTER, textColor=colors.HexColor('#101828'))
    heading = ParagraphStyle('heading', parent=normal, fontSize=13, leading=20, textColor=colors.HexColor('#101828'), spaceBefore=8, spaceAfter=6)
    right = ParagraphStyle('right', parent=normal, alignment=TA_RIGHT)
    table_header = ParagraphStyle('table_header', parent=normal, textColor=colors.white)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT, 8)
        canvas.setFillColor(colors.HexColor('#98A2B3'))
        canvas.drawString(18 * mm, 11 * mm, '订单号：' + text(order.get('orderId')))
        canvas.drawRightString(192 * mm, 11 * mm, '第 {} 页'.format(doc.page))
        canvas.restoreState()

    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=18 * mm,
                            title='船舶定制方案报价单', author='船舶定制系统')
    story = [Paragraph('船舶定制方案报价单', title), Spacer(1, 2 * mm)]
    story.append(Paragraph('订单编号：{}　　提交时间：{}　　导出时间：{}'.format(
        text(order.get('orderId')), text(order.get('createdAt')), datetime.now().strftime('%Y-%m-%d %H:%M:%S')), small))
    story.append(Spacer(1, 5 * mm))

    def section(name, rows, widths=(32 * mm, 55 * mm, 32 * mm, 55 * mm)):
        story.append(Paragraph(name, heading))
        data = []
        for row in rows:
            data.append([Paragraph(text(cell), normal) for cell in row])
        table = Table(data, colWidths=list(widths), repeatRows=0)
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), FONT), ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F2F4F7')),
            ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#F2F4F7')),
            ('GRID', (0, 0), (-1, -1), .35, colors.HexColor('#D0D5DD')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        story.append(table)

    section('一、客户信息', [
        ['客户姓名', text(order.get('customerName'), '未填写'), '联系电话', text(order.get('customerPhone'), '未填写')],
        ['客户备注', text(order.get('customerNote'), '无'), '订单状态', '已提交'],
    ])
    section('二、船型信息', [
        ['所属厂家', order.get('manufacturer'), '船型名称', order.get('boatName')],
        ['船型编号', order.get('shipId'), '模型版本', order.get('variantName') or order.get('variantId')],
        ['分类', '{} / {}'.format(text(order.get('categoryName')), text(order.get('typeName'))), '船长', order.get('length')],
        ['载客/载荷', order.get('capacity'), '极速', order.get('maxSpeed')],
    ])

    story.append(Paragraph('三、选配与颜色信息', heading))
    option_rows = [['序号', '配置分类', '选配内容', '颜色值', '加价']]
    selections = order.get('selections') or {}
    for index, item in enumerate(selections.values(), 1):
        option_rows.append([
            str(index), text(item.get('tabLabel')), text(item.get('optionName')),
            text(item.get('color'), '—'), money(item.get('priceDeltaYuan'))
        ])
    if len(option_rows) == 1:
        option_rows.append(['1', '—', '无选配记录', '—', money(0)])
    rendered_rows = [[Paragraph(text(cell), table_header if row_index == 0 else normal) for cell in row]
                     for row_index, row in enumerate(option_rows)]
    option_table = Table(rendered_rows,
                         colWidths=[12 * mm, 34 * mm, 67 * mm, 28 * mm, 33 * mm], repeatRows=1)
    option_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#101828')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white), ('FONTNAME', (0, 0), (-1, -1), FONT),
        ('GRID', (0, 0), (-1, -1), .35, colors.HexColor('#D0D5DD')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'), ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(option_table)

    story.append(Paragraph('四、报价汇总', heading))
    quote = Table([
        [Paragraph('模拟基础价', normal), Paragraph(money(order.get('basePriceYuan')), right)],
        [Paragraph('选配合计', normal), Paragraph(money(order.get('optionPriceYuan')), right)],
        [Paragraph('方案参考总价', heading), Paragraph(money(order.get('totalPriceYuan')), ParagraphStyle('total', parent=heading, alignment=TA_RIGHT))],
    ], colWidths=[100 * mm, 74 * mm])
    quote.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), .35, colors.HexColor('#D0D5DD')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#ECFDF3')),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(quote)
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph('报价说明：{}'.format(text(order.get('pricingNote'), '本报价为系统模拟参考价，仅供方案沟通；最终价格、税费、运输、交付与合同条款以厂家正式报价为准。')), small))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


if __name__ == '__main__':
    payload = json.load(sys.stdin)
    sys.stdout.buffer.write(build(payload))
