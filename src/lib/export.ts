import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, AlignmentType, TextRun, WidthType, HeadingLevel, VerticalAlign, BorderStyle } from 'docx';
import { Player, Match, Round } from '../types';

export const exportPairingToWord = async (round: Round, players: Player[], totalRounds: number) => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const tableRows = [
    new TableRow({
      children: [
        ['Bàn', 'Quân Trắng', 'Điểm', 'Kết quả', 'Điểm', 'Quân Đen'].map(text => 
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text, bold: true, size: 24 })], 
              alignment: AlignmentType.CENTER 
            })],
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100 }
          })
        )
      ].flat()
    })
  ];

  round.matches.forEach((match, index) => {
    const whitePlayer = players.find(p => p.id === match.white);
    const blackPlayer = players.find(p => p.id === match.black);

    tableRows.push(
      new TableRow({
        children: [
          (index + 1).toString(),
          whitePlayer?.name || '',
          whitePlayer?.score.toString() || '0',
          match.result || '-',
          blackPlayer?.score.toString() || '0',
          blackPlayer?.name || ''
        ].map(text => 
          new TableCell({
            children: [new Paragraph({ 
              text, 
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 }
            })],
            verticalAlign: VerticalAlign.CENTER
          })
        )
      })
    );
  });

  if (round.byePlayerId) {
    const byePlayer = players.find(p => p.id === round.byePlayerId);
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: `Miễn đấu (BYE): ${byePlayer?.name || ''} (+1 điểm)`, bold: true, size: 24 })],
              spacing: { before: 100, after: 100 }
            })],
            columnSpan: 6,
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      })
    );
  }

  const doc = new Document({
    sections: [{
      children: [
        // Header Table for Org and Motto
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: "UBND XÃ NGUYỄN VIỆT KHÁI", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "TRƯỜNG TH RẠCH CHÈO", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "Số: .............", size: 22 })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 55, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "Độc lập – Tự do – Hạnh phúc", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `Nguyễn Việt Khái, ngày ${day} tháng ${month} năm ${year}`, italics: true, size: 22 })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: "", spacing: { after: 400 } }),

        new Paragraph({
          children: [
            new TextRun({
              text: "DANH SÁCH CẶP ĐẤU",
              bold: true,
              size: 36,
              color: "2e74b5"
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Vòng: ${round.roundNumber} / ${totalRounds}`,
              size: 26,
              bold: true
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cap_Dau_Vong_${round.roundNumber}.docx`);
};

export const exportRankingsToWord = async (sortedPlayers: Player[], currentRound: number, totalRounds: number) => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const tableRows = [
    new TableRow({
      children: [
        ['Hạng', 'Họ và tên', 'Tổng điểm', 'Hệ số Buchholz'].map(text => 
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text, bold: true, size: 24 })], 
              alignment: AlignmentType.CENTER 
            })],
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100 }
          })
        )
      ].flat()
    })
  ];

  sortedPlayers.forEach((player, index) => {
    tableRows.push(
      new TableRow({
        children: [
          (index + 1).toString(),
          player.name,
          player.score.toString(),
          (player.buchholz || 0).toString()
        ].map(text => 
          new TableCell({
            children: [new Paragraph({ 
              text, 
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 }
            })],
            verticalAlign: VerticalAlign.CENTER
          })
        )
      })
    );
  });

  const doc = new Document({
    sections: [{
      children: [
        // Header Table for Org and Motto
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: "UBND XÃ NGUYỄN VIỆT KHÁI", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "TRƯỜNG TH RẠCH CHÈO", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "Số: .............", size: 22 })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 55, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: "Độc lập – Tự do – Hạnh phúc", bold: true, size: 24 })],
                      alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `Nguyễn Việt Khái, ngày ${day} tháng ${month} năm ${year}`, italics: true, size: 22 })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: "", spacing: { after: 400 } }),

        new Paragraph({
          children: [
            new TextRun({
              text: "KẾT QUẢ XẾP HẠNG",
              bold: true,
              size: 36,
              color: "2e74b5" // Blue color from the mockup
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Giải đấu sau Vòng: ${currentRound} / ${totalRounds}`,
              size: 26,
              bold: true
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bang_Xep_Hang_Vong_${currentRound}.docx`);
};
