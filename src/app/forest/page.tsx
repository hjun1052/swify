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
  const [scores, setScores] = useState<Score[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewport State
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: -1500, y: -1500 }); // Center roughly
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Planting State
  const [plantingCategory, setPlantingCategory] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchForestData();
  }, []);

  const fetchForestData = async () => {
    try {
      const res = await fetch("/api/forest");
      const data = await res.json();
      if (data.scores) setScores(data.scores);
      if (data.trees) setTrees(data.trees);
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

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMapClick = async (e: React.MouseEvent) => {
    if (!plantingCategory) return;

    // Calculate click position relative to map origin
    // e.clientX = offset.x + mapX
    // mapX = e.clientX - offset.x
    const mapX = e.clientX - offset.x;
    const mapY = e.clientY - offset.y;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newTree: Tree = {
      id: tempId,
      category: plantingCategory,
      x: mapX,
      y: mapY,
      plantedAt: new Date().toISOString(),
    };

    setTrees((prev) => [...prev, newTree]);
    setPlantingCategory(null); // Exit planting mode

    try {
      const res = await fetch("/api/forest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "plant",
          category: plantingCategory,
          x: mapX,
          y: mapY,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        // Revert on failure
        setTrees((prev) => prev.filter((t) => t.id !== tempId));
        alert(data.error || "Failed to plant tree");
      } else {
        // Update score from server response to sync deduction
        fetchForestData();
      }
    } catch (e) {
      console.error(e);
      setTrees((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const startPlanting = (category: string, score: number) => {
    if (score < 6) return;
    setPlantingCategory(category);
  };

  return (
    <div
      className={styles.container}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Back Button */}
      <div
        style={{ position: 'fixed', top: 20, left: 20, zIndex: 100, cursor: 'pointer' }}
        onClick={() => router.push('/library')}
      >
        <MoveLeft color="white" />
      </div>

      {/* Viewport / Map */}
      <div
        className={`${styles.viewport} ${plantingCategory ? styles.plantingMode : ''}`}
        onMouseDown={handleMouseDown}
        onClick={handleMapClick}
      >
        <div
          className={styles.forestLayer}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
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
                  filter: `hue-rotate(${getCategoryHue(tree.category)}deg)` // Color variance by category
                }}
              />
              <div className={styles.tooltip}>
                {tree.category}
                <br />
                {new Date(tree.plantedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ghost Tree Logic */}
      {plantingCategory && (
        <div
          className={styles.ghostTree}
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <img
            src="/trees/large.png"
            alt="Ghost Tree"
            style={{
              filter: `hue-rotate(${getCategoryHue(plantingCategory)}deg)`
            }}
          />
        </div>
      )}

      {/* Inventory */}
      <div className={styles.inventoryBar}>
        {loading ? (
          <div>Loading Forest...</div>
        ) : scores.length === 0 ? (
          <div style={{ color: '#888', fontSize: '0.8rem' }}>Watch videos to grow trees!</div>
        ) : (
          scores.map((s) => {
            const stage = getStage(s.score);
            const isReady = s.score >= 6;
            const progress = Math.min((s.score % 6) / 6 * 100, 100); // Rough progress visualization or logic change needed for >6

            return (
              <div
                key={s.category}
                className={`${styles.inventoryItem} ${isReady ? styles.ready : ''}`}
                onClick={() => startPlanting(s.category, s.score)}
              >
                <img
                  src={`/trees/${stage.image}`}
                  className={styles.treeIcon}
                  style={{
                    filter: `hue-rotate(${getCategoryHue(s.category)}deg)`
                  }}
                />
                <div className={styles.itemName}>{s.category}</div>
                <div className={styles.itemName} style={{ fontSize: '0.6rem' }}>Score: {s.score}</div>
                {isReady && <div style={{ fontSize: '0.6rem', color: '#10B981' }}>PLANT ME!</div>}
              </div>
            );
          })
        )}
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
