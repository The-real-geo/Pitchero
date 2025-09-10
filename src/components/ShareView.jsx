// ShareView.jsx - Fixed resolver to correctly display DB pitch names (mobile + desktop)
setCanvasSize(calcCanvas(imageWidth, imageHeight));
setImgLoaded(true);
};


const draw = useCallback(() => {
const canvas = canvasRef.current;
const image = imgRef.current;
const sc = sharedData?.satelliteConfig;
if (!canvas || !image || !imgLoaded || !sc) return;


const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(image, 0, 0, canvas.width, canvas.height);


const sx = canvas.width / (sc.imageWidth || 1);
const sy = canvas.height / (sc.imageHeight || 1);


(sc.pitchBoundaries || []).forEach((p) => {
const { x1, y1, x2, y2 } = p.boundaries || {};
const x = (x1 || 0) * sx;
const y = (y1 || 0) * sy;
const w = ((x2 || 0) - (x1 || 0)) * sx;
const h = ((y2 || 0) - (y1 || 0)) * sy;


ctx.fillStyle = 'rgba(34,197,94,0.35)';
ctx.fillRect(x, y, w, h);
ctx.strokeStyle = '#16a34a';
ctx.lineWidth = 2;
ctx.strokeRect(x, y, w, h);


const label = resolvePitchName(p.pitchNumber, pitchNames);
ctx.fillStyle = '#111827';
ctx.font = 'bold 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(label, x + w / 2, y + h / 2);
});
}, [sharedData, imgLoaded, pitchNames]);


useEffect(() => {
if (imgLoaded) draw();
}, [imgLoaded, draw, pitchNamesVersion]);


if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;


const sc = sharedData?.satelliteConfig;


return (
<div style={{ padding: isMobile ? 12 : 24, background: '#f9fafb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
<h1 style={{ margin: '0 0 12px', fontSize: isMobile ? 20 : 28 }}>{sharedData?.clubName} – Allocations</h1>


<div style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
{imgUrl ? (
<>
<canvas
ref={canvasRef}
width={canvasSize.width}
height={canvasSize.height}
style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
/>
<img
ref={imgRef}
src={imgUrl}
onLoad={onImgLoad}
alt="Satellite"
style={{ display: 'none' }}
/>
</>
) : (
<div style={{ height: 320, display: 'grid', placeItems: 'center', color: '#6b7280' }}>Loading satellite…</div>
)}
</div>


{/* Pitch Legend */}
<div style={{ marginTop: 16, background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
<h2 style={{ fontSize: isMobile ? 16 : 18, margin: '0 0 8px' }}>Pitch Legend</h2>
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
{(sc?.pitchBoundaries || []).map((p) => {
const name = resolvePitchName(p.pitchNumber, pitchNames);
return (
<div key={`legend-${p.pitchNumber}-${pitchNamesVersion}`} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>
{name}
</div>
);
})}
</div>
</div>
</div>
);
}

export default ShareView;
