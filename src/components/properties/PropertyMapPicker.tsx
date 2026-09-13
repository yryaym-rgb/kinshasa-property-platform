import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from '@/components/ui/Input';

const KINSHASA_CENTER = { lat: -4.3217, lng: 15.3125 };

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapClickHandlerProps {
  onPositionChange: (lat: number, lng: number) => void;
}

function MapClickHandler({ onPositionChange }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface PropertyMapPickerProps {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
}

export function PropertyMapPicker({ value, onChange, className }: PropertyMapPickerProps) {
  const [position, setPosition] = useState(value ?? KINSHASA_CENTER);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (value) setPosition(value);
  }, [value]);

  const handleChange = (lat: number, lng: number) => {
    setPosition({ lat, lng });
    onChange({ lat, lng });
  };

  return (
    <div className={className}>
      <div className="h-64 overflow-hidden rounded-lg border border-[var(--color-border)]">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={15}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[position.lat, position.lng]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const { lat, lng } = marker.getLatLng();
                handleChange(lat, lng);
              },
            }}
          />
          <MapClickHandler onPositionChange={handleChange} />
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        Cliquez sur la carte ou déplacez le marqueur pour définir la position GPS.
      </p>
      <button
        type="button"
        className="mt-2 text-sm text-[var(--color-kinshasa-blue)] hover:underline"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? 'Masquer les coordonnées' : 'Saisie manuelle des coordonnées'}
      </button>
      {showAdvanced && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Latitude"
            type="number"
            step="any"
            value={position.lat}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0, position.lng)}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            value={position.lng}
            onChange={(e) => handleChange(position.lat, parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
    </div>
  );
}
