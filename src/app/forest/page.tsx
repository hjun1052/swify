"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { MoveLeft, User } from "lucide-react";
import { useRouter } from "next/navigation";

// Define score thresholds and associated images
const GROWTH_STAGES = [
  { min: 0, image: "seed.png", label: "Seed" },
  { min: 1, image: "seed.png", label: "Seed" },
  { min: 2, image: "sprout.png", label: "Sprout" },
  { min: 3, image: "small.png", label: "Sapling" },
  { min: 4, image: "medium.png", label: "Young Tree" },
  { min: 6, image: "large.png", label: "Mature Tree" }, // Plantable
];

interface Score {
  category: string;
  score: number;
}

interface Tree {
  id: string;
  category: string;
  x: number;
  y: number;
  plantedAt: string;
}

export default function ForestPage() {
  const router = useRouter();
  const [tiles, setTiles] = useState<{ type: string; count: number }[]>([]);
  const [placedTiles, setPlacedTiles] = useState<{ id: string; type: string; x: number; y: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'trees' | 'tiles'>('trees');

  // Re-add missing state
  const [scores, setScores] = useState<Score[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewport State
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: -1500, y: -1500 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Grid Snapping
  const GRID_SIZE = 64;
  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // Planting State
  const [plantingCategory, setPlantingCategory] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchForestData();

    // Expose cheats
    (window as any).swifyDebug = {
      addTree: async (category: string, amount: number) => {
        await fetch('/api/forest', {
          method: 'POST',
          body: JSON.stringify({ action: 'debug_add', category, amount })
        });
        fetchForestData();
        console.log(`Added ${amount} score to ${category}`);
      },
      addTile: async (type: string, amount: number) => {
        await fetch('/api/forest', {
          method: 'POST',
          body: JSON.stringify({ action: 'debug_add', type, amount })
        });
        fetchForestData();
        console.log(`Added ${amount} ${type} tiles`);
      }
    };
  }, []);

  const fetchForestData = async () => {
    try {
      const res = await fetch("/api/forest");
      const data = await res.json();
      if (data.scores) setScores(data.scores);
      if (data.trees) setTrees(data.trees);
      if (data.tiles) setTiles(data.tiles);
      if (data.placedTiles) setPlacedTiles(data.placedTiles);

      if (data.newRewards) {
        alert(`Daily Login Reward! obtained: ${data.newRewards.map((t: any) => `${t.count} ${t.type}`).join(', ')}`);
      }
    } catch (e) {
      console.error("Failed to load forest", e);
    } finally {
      setLoading(false);
    }
  };

  const getStage = (score: number) => {
    // Find highest matching stage
    return GROWTH_STAGES.reduce((prev, curr) => {
      return score >= curr.min ? curr : prev;
    }, GROWTH_STAGES[0]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (plantingCategory) return; // Don't drag while planting
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Snap ghost cursor
    if (plantingCategory) {
      // We want the ghost to snap to the grid relative to the map
      // But mousePos is screen coordinates for the fixed ghost element
      // This is tricky visually. 
      // Better approach: Calculate the "would-be" grid position in map space, then project back to screen space?
      // Actually, let's just stick to the mouse follow for smoothness, or snap it?
      // User asked for logic adjustment "to be aligned with grid".
      // Let's snap the Ghost Tree visual if possible.

      // Current Mouse Screen Pos
      const mx = e.clientX;
      const my = e.clientY;

      // If we have container ref, valid map offset
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const relX = mx - rect.left;
        const relY = my - rect.top;

        // Map Space
        const mapX = relX - offset.x;
        const mapY = relY - offset.y;

        // Snap Map Space
        const snappedMapX = snapToGrid(mapX);
        const snappedMapY = snapToGrid(mapY);

        // Back to Screen Space for Ghost (which is fixed/absolute on screen? No, likely absolute in viewport or fixed?)
        // ghostTree class says: position: fixed.

        // Screen X = SnappedMapX + offset.x + rect.left
        const screenX = snappedMapX + offset.x + rect.left;
        const screenY = snappedMapY + offset.y + rect.top;

        setMousePos({ x: screenX, y: screenY });
      } else {
        setMousePos({ x: mx, y: my });
      }
    } else {
      setMousePos({ x: e.clientX, y: e.clientY });
    }

    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (plantingCategory) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setLastPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastPos.x;
      const dy = touch.clientY - lastPos.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMapClick = async (e: React.MouseEvent) => {
    if (!plantingCategory || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const mapX = relX - offset.x;
    const mapY = relY - offset.y;

    const gridX = snapToGrid(mapX);
    const gridY = snapToGrid(mapY);

    if (activeTab === 'trees') {
      // Optimistic update Tree
      const tempId = `temp-${Date.now()}`;
      const newTree: Tree = {
        id: tempId,
        category: plantingCategory,
        x: gridX,
        y: gridY,
        plantedAt: new Date().toISOString(),
      };

      setTrees((prev) => [...prev, newTree]);
      setPlantingCategory(null);

      try {
        const res = await fetch("/api/forest", {
          method: "POST",
          body: JSON.stringify({
            action: "plant_tree",
            category: plantingCategory,
            x: gridX,
            y: gridY,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setTrees((prev) => prev.filter((t) => t.id !== tempId));
          alert(data.error);
        } else {
          fetchForestData();
        }
      } catch (e) {
        setTrees((prev) => prev.filter((t) => t.id !== tempId));
      }
    } else if (activeTab === 'tiles') {
      // Optimistic Update Tile
      const tempId = `temp-tile-${Date.now()}`;
      const newTile = { id: tempId, type: plantingCategory, x: gridX, y: gridY };
      setPlacedTiles(prev => [...prev, newTile]);
      setPlantingCategory(null);

      // Decr inventory locally
      setTiles(prev => prev.map(t => t.type === plantingCategory ? { ...t, count: t.count - 1 } : t));

      try {
        const res = await fetch("/api/forest", {
          method: "POST",
          body: JSON.stringify({
            action: "place_tile",
            type: plantingCategory,
            x: gridX,
            y: gridY
          })
        });
        const data = await res.json();
        if (!data.success) {
          setPlacedTiles(prev => prev.filter(t => t.id !== tempId));
          // Revert inv
          setTiles(prev => prev.map(t => t.type === plantingCategory ? { ...t, count: t.count + 1 } : t));
          alert(data.error);
        } else {
          fetchForestData();
        }
      } catch (e) {
        setPlacedTiles(prev => prev.filter(t => t.id !== tempId));
      }
    }
  };

  const startPlanting = (item: any) => {
    // For trees, item is Score object. For tiles, item is Tile object.
    if (activeTab === 'trees') {
      if (item.score < 6) return;
      setPlantingCategory(item.category);
    } else {
      if (item.count < 1) return;
      setPlantingCategory(item.type);
    }
  };

  // ... (existing handlers)



  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back Button */}
      <div
        style={{ position: 'fixed', top: 20, left: 20, zIndex: 100, cursor: 'pointer' }}
        onClick={() => router.back()}
      >
        <MoveLeft color="white" />
      </div>

      {/* Viewport */}
      <div
        className={`${styles.viewport} ${plantingCategory ? styles.plantingMode : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleMapClick}
      >
        <div
          className={styles.forestLayer}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          {/* Tiles Layer (First) */}
          {placedTiles.map(tile => (
            <div
              key={tile.id}
              style={{
                position: 'absolute',
                left: tile.x,
                top: tile.y,
                width: 64,
                height: 64,
                transform: 'translate(-50%, -50%)', // Center on grid
                backgroundImage: `url(/tiles/${tile.type}-tile.png)`,
                backgroundSize: 'cover',
                imageRendering: 'pixelated'
              }}
            />
          ))}

          {/* Trees Layer */}
          {trees.map((tree) => (
            <div
              key={tree.id}
              className={styles.plantedTree}
              style={{ left: tree.x, top: tree.y }}
            >
              <img
                src="/trees/large.png"
                alt="Tree"
                style={{
                  filter: `hue-rotate(${getCategoryHue(tree.category)}deg)`
                }}
              />
              <div className={styles.tooltip}>{tree.category}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ghost */}
      {plantingCategory && (
        <div
          className={styles.ghostTree}
          style={{
            left: mousePos.x,
            top: mousePos.y,
            // Tiles need to be centered (-50%, -50%), Trees need bottom anchor (-50%, -100%)
            transform: activeTab === 'tiles' ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)'
          }}
        >
          {activeTab === 'trees' ? (
            <img
              src="/trees/large.png"
              alt="Ghost"
              style={{ filter: `hue-rotate(${getCategoryHue(plantingCategory)}deg)` }}
            />
          ) : (
            <img
              src={`/tiles/${plantingCategory}-tile.png`}
              alt="Ghost Tile"
              style={{ width: 64, height: 64, opacity: 0.8 }}
            />
          )}
        </div>
      )}

      {/* ... (Inventory remains same) ... */}
      <div className={styles.inventoryBar}>
        {/* Simple Tabs */}
        <div className={styles.tabs}>
          <button className={activeTab === 'trees' ? styles.activeTab : ''} onClick={() => setActiveTab('trees')}>Trees</button>
          <button className={activeTab === 'tiles' ? styles.activeTab : ''} onClick={() => setActiveTab('tiles')}>Tiles</button>
        </div>

        <div className={styles.itemsRow}>
          {loading ? <div>Loading...</div> :
            activeTab === 'trees' ? (
              scores.length === 0 ? <div style={{ color: '#888', fontSize: '0.8rem' }}>Watch videos to get seeds!</div> :
                scores.map(s => {
                  const stage = getStage(s.score);
                  const isReady = s.score >= 6;
                  return (
                    <div key={s.category}
                      className={`${styles.inventoryItem} ${isReady ? styles.ready : ''}`}
                      onClick={() => startPlanting(s)}>
                      <img src={`/trees/${stage.image}`} className={styles.treeIcon} style={{ filter: `hue-rotate(${getCategoryHue(s.category)}deg)` }} />
                      <div className={styles.itemName}>{s.category}</div>
                      <div className={styles.itemName} style={{ fontSize: '0.6rem' }}>Score: {s.score}</div>
                      {isReady && <div style={{ fontSize: '0.6rem', color: '#10B981' }}>PLANT</div>}
                    </div>
                  )
                })
            ) : (
              tiles.length === 0 ? <div style={{ color: '#888', fontSize: '0.8rem' }}>No tiles yet. Come back tomorrow!</div> :
                tiles.map(t => (
                  <div key={t.type} className={`${styles.inventoryItem} ${t.count > 0 ? styles.ready : ''}`} onClick={() => startPlanting(t)}>
                    <img src={`/tiles/${t.type}-tile.png`} className={styles.treeIcon} />
                    <div className={styles.itemName}>{t.type}</div>
                    <div className={styles.itemName}>x{t.count}</div>
                  </div>
                ))
            )
          }
        </div>
      </div>
    </div>
  );
}

// Helper to generate consistent colors per category
function getCategoryHue(category: string): number {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash % 360;
}
