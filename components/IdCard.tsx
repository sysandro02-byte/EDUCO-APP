import React, { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QRCodeSVG } from "qrcode.react";

import { User } from './UserForm';
import { Personnel } from '../App';
import { SchoolSettings } from '../App';
import { LogoIcon } from './Icons';

type Person = User | Personnel;

interface IdCardProps {
  person: Person;
  schoolSettings: SchoolSettings;
  onClose: () => void;
}

const IdCard: React.FC<IdCardProps> = ({ person, schoolSettings, onClose }) => {
  const badgeRef = useRef<HTMLDivElement>(null);

  const isStudent = 'studentId' in person;
  const [firstName, ...lastNameParts] = person.name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  const badgeData = {
    id: person.id!.toString(),
    nom: lastName,
    prenom: firstName,
    photo: person.avatar || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231F4A59"/><text x="50" y="58" font-size="36" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">${(firstName?.[0] || 'U').toUpperCase()}</text></svg>`,
    code: isStudent ? (person as User).studentId : (person as Personnel).matricule || `P-${person.id}`,
    classe: isStudent ? (person as User).class : undefined,
    profession: !isStudent ? person.role : undefined,
    type: isStudent ? 'eleve' : 'personnel',
  };

  const handleDownloadPDF = async () => {
    const element = badgeRef.current;
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85.6, 54], // taille carte de crédit
    });
    pdf.addImage(imgData, "PNG", 0, 0, 85.6, 54);
    pdf.save(`${badgeData.nom}_${badgeData.prenom}_badge.pdf`);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Prévisualisation du badge */}
      <div
        ref={badgeRef}
        className="relative w-[340px] h-[215px] bg-gradient-to-br from-blue-600 to-blue-400 text-white rounded-xl shadow-2xl p-4 border-2 border-blue-700 font-sans"
      >
        {/* Bande du haut */}
        <div className="flex justify-between items-center mb-2">
          <div className="bg-white p-1 rounded-full">
            <LogoIcon className="w-12 h-12" />
          </div>
          <span className="text-sm font-semibold italic">
            Année scolaire {schoolSettings.currentYear}
          </span>
        </div>

        {/* Photo + Infos */}
        <div className="flex items-center space-x-3">
          <img
            src={badgeData.photo}
            alt="photo"
            className="w-20 h-20 rounded-lg border-2 border-white object-cover"
          />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold">
              {badgeData.prenom} {badgeData.nom}
            </h2>
            <p className="text-sm">Code : {badgeData.code}</p>
            {badgeData.type === "eleve" ? (
              <p className="text-sm">Classe : {badgeData.classe}</p>
            ) : (
              <p className="text-sm">Profession : {badgeData.profession}</p>
            )}
          </div>
        </div>

        {/* Ligne de séparation */}
        <div className="border-t-2 border-white opacity-60 my-2"></div>

        {/* Pied du badge */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs italic">{schoolSettings.name}</p>
            <p className="text-[10px] opacity-80">Carte d’identification</p>
          </div>
          <div className="bg-white p-1 rounded-sm">
            <QRCodeSVG value={`https://educo.app/${badgeData.type}/${badgeData.id}`} size={45} bgColor="#ffffff" fgColor="#000000" level="H" />
          </div>
        </div>

        {/* Tampon / Signature */}
        <div className="absolute bottom-1 right-2 text-[8px] italic opacity-70">
          <p>Validé par la direction</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-md transition-all cursor-pointer"
        >
          📥 Télécharger (PDF)
        </button>
        <button
          onClick={() => {
            const printWindow = window.open('', '_blank');
            if (printWindow && badgeRef.current) {
              printWindow.document.write(`<html><head><title>Badge - ${badgeData.prenom} ${badgeData.nom}</title>`);
              printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
              printWindow.document.write(`<style>
                @page { size: 85.6mm 54mm landscape; margin: 0; }
                @media print {
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    height: 100% !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
              </style>`);
              printWindow.document.write('</head><body class="bg-white">');
              printWindow.document.write(badgeRef.current.outerHTML);
              printWindow.document.write('</body></html>');
              printWindow.document.close();
              setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
              }, 400);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-lg shadow-md transition-all cursor-pointer"
        >
          🖨️ Imprimer direct
        </button>
      </div>
    </div>
  );
};

export default IdCard;
