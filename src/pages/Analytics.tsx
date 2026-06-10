import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AnalyticsCategoryPane,
  type AnalyticsCategory,
  ANALYTICS_CATEGORIES,
} from "@/components/panes/AnalyticsCategoryPane";
import { AnalyticsDetailPane } from "@/components/panes/AnalyticsDetailPane";
import { AppShell } from "@/components/layout/AppShell";

// Valid category IDs for URL validation
const VALID_CATEGORY_IDS = ANALYTICS_CATEGORIES.map((c) => c.id);

export default function Analytics() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();

  // --- Pane System Logic ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] =
    useState<AnalyticsCategory | null>(null);

  // --- Deep Link Handling ---
  // Keep the selected pane driven by the URL; user handlers below update both.
  useEffect(() => {
    if (urlCategory) {
      if (VALID_CATEGORY_IDS.includes(urlCategory as AnalyticsCategory)) {
        setSelectedCategory(urlCategory as AnalyticsCategory);
      } else {
        navigate("/analytics", { replace: true });
      }
    } else {
      const firstCategory = ANALYTICS_CATEGORIES[0];
      if (firstCategory) {
        setSelectedCategory(firstCategory.id);
        navigate(`/analytics/${firstCategory.id}`, { replace: true });
      }
    }
  }, [urlCategory, navigate]);

  // --- Pane System Handlers ---
  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: AnalyticsCategory) => {
    setSelectedCategory(category);
    navigate(`/analytics/${category}`, { replace: true });
  }, [navigate]);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
    navigate("/analytics", { replace: true });
  }, [navigate]);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
    navigate("/analytics", { replace: true });
  }, [navigate]);

  return (
    <AppShell
      config={{
        secondaryPane: (
          <AnalyticsCategoryPane
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        ),
        showDetailPane: false,
      }}
    >
      {/* Analytics Detail Pane - shown when category is selected */}
      {selectedCategory && (
        <AnalyticsDetailPane
          category={selectedCategory}
          onClose={handleCloseDetailPane}
          onBack={handleBackFromDetail}
          showBackButton={false}
        />
      )}
    </AppShell>
  );
}
