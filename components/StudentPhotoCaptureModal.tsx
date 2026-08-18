import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  X, 
  RefreshCw, 
  Sparkles, 
  Image as ImageIcon,
  User
} from 'lucide-react';

interface StudentPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (photoBase64: string) => void;
  currentPhoto?: string;
  studentName?: string;
}

const StudentPhotoCaptureModal: React.FC<StudentPhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  currentPhoto,
  studentName
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(currentPhoto || null);
      setRotation(0);
      if (activeMode === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, cameraFacing]);

  // Start webcam
  const startCamera = async () => {
    stopCamera();
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraActive(true);
        }
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Flip Camera between front & back
  const handleToggleCamera = () => {
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Take Snapshot from video stream
  const handleSnapPhoto = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          executeCapture();
          return null;
        }
        return prev - 1;
      });
    }, 600);
  };

  const executeCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Set 3:4 portrait ratio for student ID photo
    const targetWidth = 480;
    const targetHeight = 640;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Calculate crop from center of video feed
      const videoRatio = video.videoWidth / video.videoHeight;
      const targetRatio = targetWidth / targetHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;

      if (videoRatio > targetRatio) {
        sourceWidth = video.videoHeight * targetRatio;
        sourceX = (video.videoWidth - sourceWidth) / 2;
      } else {
        sourceHeight = video.videoWidth / targetRatio;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }

      ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  // Handle file / photo card upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCapturedImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Rotate photo 90 degrees
  const handleRotate = () => {
    if (!capturedImage) return;
    const canvas = document.createElement('canvas');
    const image = new Image();
    image.onload = () => {
      canvas.width = image.height;
      canvas.height = image.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.88));
      }
    };
    image.src = capturedImage;
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage) {
      onPhotoCaptured(capturedImage);
      stopCamera();
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    if (activeMode === 'camera') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#1F4A59] to-[#2E6B80] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-xs rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                Photo de l'élève {studentName ? `• ${studentName}` : ''}
              </h3>
              <p className="text-xs text-white/80">Prise de vue directe ou importation carte photo</p>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveMode('camera'); setCapturedImage(null); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeMode === 'camera'
                ? 'bg-white text-[#1F4A59] border-b-2 border-[#1F4A59]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Photographier l'élève (Caméra)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMode('upload'); stopCamera(); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeMode === 'upload'
                ? 'bg-white text-[#1F4A59] border-b-2 border-[#1F4A59]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Insérer Carte Photo / Fichier</span>
          </button>
        </div>

        {/* Main Viewport */}
        <div className="p-6 flex flex-col items-center">
          {capturedImage ? (
            /* PREVIEW OF CAPTURED / UPLOADED PHOTO */
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="relative w-48 h-64 rounded-xl overflow-hidden border-4 border-[#1F4A59] shadow-lg bg-gray-100 flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="Aperçu Élève"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  Prêt
                </div>
              </div>

              {/* Photo adjustments */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Pivoter 90°</span>
                </button>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reprendre</span>
                </button>
              </div>
            </div>
          ) : activeMode === 'camera' ? (
            /* LIVE CAMERA STREAM VIEW */
            <div className="flex flex-col items-center w-full space-y-4">
              <div className="relative w-64 h-80 rounded-2xl overflow-hidden bg-gray-900 border-4 border-indigo-100 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Framing Guide for Student Face */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                  <div className="w-40 h-52 border-2 border-dashed border-white/70 rounded-full flex items-center justify-center shadow-xs">
                    <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full font-medium">
                      Centrer le visage
                    </span>
                  </div>
                </div>

                {/* Countdown overlay */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                    <span className="text-6xl font-extrabold animate-ping">{countdown}</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 w-full">
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  title="Basculer caméra avant/arrière"
                  className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleSnapPhoto}
                  className="px-6 py-3 bg-[#1F4A59] hover:bg-[#2c5a6e] text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span>Capturer la Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* FILE / PHOTO CARD UPLOAD VIEW */
            <div className="w-full flex flex-col items-center space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-gray-300 hover:border-[#1F4A59] rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer bg-gray-50 hover:bg-indigo-50/30 transition-all"
              >
                <div className="p-4 bg-indigo-50 text-indigo-700 rounded-full mb-3">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-gray-800 text-sm">Insérer la carte photo de l'élève</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Glissez-déposez le fichier image ou cliquez pour parcourir les dossiers (JPG, PNG, WEBP).
                </p>
                <span className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-[#1F4A59] shadow-2xs">
                  Sélectionner un fichier
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { stopCamera(); onClose(); }}
            className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>

          {capturedImage && (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Valider la photo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentPhotoCaptureModal;
