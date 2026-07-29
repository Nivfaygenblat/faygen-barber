"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { adminFetch } from "@/lib/admin/client";

type GalleryItem = {
  id: string;
  slot_key: string;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type GalleryVersion = {
  id: string;
  gallery_item_id: string;
  title: string;
  image_url: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

function normalizeOrder(items: GalleryItem[]) {
  return items.map((item, index) => ({
    ...item,
    sort_order: index + 1,
  }));
}

function formatVersionDate(value: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [savedItems, setSavedItems] = useState<
    GalleryItem[]
  >([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingItemId, setUploadingItemId] =
    useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] =
    useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] =
    useState<string | null>(null);

  const [historyItem, setHistoryItem] =
    useState<GalleryItem | null>(null);
  const [versions, setVersions] = useState<
    GalleryVersion[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] =
    useState(false);
  const [historyError, setHistoryError] =
    useState("");
  const [restoringVersionId, setRestoringVersionId] =
    useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasChanges =
    JSON.stringify(items) !== JSON.stringify(savedItems);

  const loadGallery = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await adminFetch(
        "/api/admin/gallery"
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error || "לא ניתן לטעון את הגלריה"
        );
        return;
      }

      const loadedItems = normalizeOrder(
        Array.isArray(data.items) ? data.items : []
      );

      setItems(loadedItems);
      setSavedItems(loadedItems);
    } catch (error) {
      console.error("Failed to load gallery:", error);
      setMessage("אירעה שגיאה בטעינת הגלריה");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadGallery();
  }, []);

  const updateTitle = (
    itemId: string,
    title: string
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              title: title.trim() || item.title,
            }
          : item
      )
    );
  };

  const openFilePicker = (itemId: string) => {
    if (uploadingItemId) {
      return;
    }

    setSelectedItemId(itemId);
    fileInputRef.current?.click();
  };

  const uploadImage = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const itemId = selectedItemId;

    event.target.value = "";

    if (!file || !itemId) {
      return;
    }

    setUploadingItemId(itemId);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await adminFetch(
        "/api/admin/gallery/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error || "לא ניתן להעלות את התמונה"
        );
        return;
      }

      if (
        typeof data.image_url !== "string" ||
        !data.image_url
      ) {
        setMessage(
          "העלאת התמונה הסתיימה ללא כתובת תקינה"
        );
        return;
      }

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                image_url: data.image_url,
              }
            : item
        )
      );

      setMessage(
        'התמונה הועלתה. יש ללחוץ על "שמור שינויים" כדי לפרסם אותה.'
      );
    } catch (error) {
      console.error(
        "Failed to upload gallery image:",
        error
      );
      setMessage("אירעה שגיאה בהעלאת התמונה");
    } finally {
      setUploadingItemId(null);
      setSelectedItemId(null);
    }
  };

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    itemId: string
  ) => {
    setDraggedItemId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      itemId
    );
  };

  const handleDragOver = (
    event: DragEvent<HTMLElement>
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    targetItemId: string
  ) => {
    event.preventDefault();

    const sourceItemId =
      draggedItemId ||
      event.dataTransfer.getData("text/plain");

    setDraggedItemId(null);

    if (
      !sourceItemId ||
      sourceItemId === targetItemId
    ) {
      return;
    }

    setItems((currentItems) => {
      const nextItems = [...currentItems];
      const sourceIndex = nextItems.findIndex(
        (item) => item.id === sourceItemId
      );
      const targetIndex = nextItems.findIndex(
        (item) => item.id === targetItemId
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentItems;
      }

      const [movedItem] = nextItems.splice(
        sourceIndex,
        1
      );

      nextItems.splice(targetIndex, 0, movedItem);

      return normalizeOrder(nextItems);
    });
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  const resetChanges = () => {
    setItems(savedItems);
    setMessage("השינויים שלא נשמרו בוטלו");
  };

  const saveChanges = async () => {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await adminFetch(
        "/api/admin/gallery",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: items.map((item, index) => ({
              id: item.id,
              title: item.title.trim(),
              image_url: item.image_url,
              sort_order: index + 1,
              is_active: item.is_active,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error || "לא ניתן לשמור את הגלריה"
        );
        return;
      }

      const normalizedItems = normalizeOrder(items);

      setItems(normalizedItems);
      setSavedItems(normalizedItems);
      setMessage("השינויים נשמרו בהצלחה");
    } catch (error) {
      console.error("Failed to save gallery:", error);
      setMessage("אירעה שגיאה בשמירת הגלריה");
    } finally {
      setIsSaving(false);
    }
  };

  const closeHistory = () => {
    if (restoringVersionId) {
      return;
    }

    setHistoryItem(null);
    setVersions([]);
    setHistoryError("");
  };

  const openHistory = async (item: GalleryItem) => {
    if (hasChanges) {
      setMessage(
        "לפני פתיחת ההיסטוריה יש לשמור או לבטל את השינויים שלא נשמרו."
      );
      return;
    }

    setHistoryItem(item);
    setVersions([]);
    setHistoryError("");
    setIsHistoryLoading(true);

    try {
      const response = await adminFetch(
        `/api/admin/gallery/${item.id}/versions`
      );
      const data = await response.json();

      if (!response.ok) {
        setHistoryError(
          data.error ||
            "לא ניתן לטעון את היסטוריית הגרסאות"
        );
        return;
      }

      setVersions(
        Array.isArray(data.versions)
          ? data.versions
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load gallery history:",
        error
      );
      setHistoryError(
        "אירעה שגיאה בטעינת היסטוריית הגרסאות"
      );
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const restoreVersion = async (
    version: GalleryVersion
  ) => {
    if (!historyItem || restoringVersionId) {
      return;
    }

    const confirmed = window.confirm(
      `לשחזר את הגרסה מתאריך ${formatVersionDate(
        version.created_at
      )}? המצב הנוכחי יישמר אוטומטית בהיסטוריה.`
    );

    if (!confirmed) {
      return;
    }

    setRestoringVersionId(version.id);
    setHistoryError("");

    try {
      const response = await adminFetch(
        `/api/admin/gallery/${historyItem.id}/restore`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version_id: version.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setHistoryError(
          data.error || "לא ניתן לשחזר את הגרסה"
        );
        return;
      }

      closeHistory();
      await loadGallery();
      setMessage("הגרסה שוחזרה בהצלחה");
    } catch (error) {
      console.error(
        "Failed to restore gallery version:",
        error
      );
      setHistoryError(
        "אירעה שגיאה בשחזור הגרסה"
      );
    } finally {
      setRestoringVersionId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">גלריה</p>
          <h1>ניהול גלריה</h1>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="outline-button"
            onClick={resetChanges}
            disabled={!hasChanges || isSaving}
          >
            ביטול שינויים
          </button>

          <button
            type="button"
            className="button"
            onClick={saveChanges}
            disabled={
              !hasChanges ||
              isSaving ||
              Boolean(uploadingItemId)
            }
          >
            {isSaving
              ? "שומר..."
              : "שמור שינויים"}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={uploadImage}
        hidden
      />

      {message ? (
        <div className="panel info-box">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="panel">
          טוען את הגלריה...
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="panel">
          לא נמצאו תמונות בגלריה.
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <section
          className="gallery"
          id="gallery-admin"
        >
          <div className="section-heading reveal">
            <p>העבודות שלנו</p>
            <h2>עבודות נבחרות</h2>
          </div>

          <div className="gallery-grid">
            {items.map((item) => {
              const isUploading =
                uploadingItemId === item.id;
              const isDragging =
                draggedItemId === item.id;

              return (
                <figure
                  key={item.id}
                  className="gallery-card"
                  draggable={!isUploading}
                  onDragStart={(event) =>
                    handleDragStart(event, item.id)
                  }
                  onDragOver={handleDragOver}
                  onDrop={(event) =>
                    handleDrop(event, item.id)
                  }
                  onDragEnd={handleDragEnd}
                  style={{
                    position: "relative",
                    cursor: isUploading
                      ? "wait"
                      : "grab",
                    opacity: isDragging ? 0.5 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openHistory(item);
                    }}
                    onMouseDown={(event) =>
                      event.stopPropagation()
                    }
                    disabled={
                      Boolean(uploadingItemId) ||
                      isSaving
                    }
                    aria-label={`היסטוריית גרסאות של ${item.title}`}
                    title="היסטוריית גרסאות"
                    style={{
                      position: "absolute",
                      top: "12px",
                      left: "12px",
                      zIndex: 3,
                      minWidth: "86px",
                      height: "36px",
                      padding: "0 12px",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      borderRadius: "999px",
                      background: "rgba(0, 0, 0, 0.72)",
                      color: "#fff",
                      font: "inherit",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    היסטוריה
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openFilePicker(item.id)
                    }
                    disabled={Boolean(uploadingItemId)}
                    aria-label={`החלפת התמונה ${item.title}`}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 0,
                      border: 0,
                      background: "transparent",
                      cursor: isUploading
                        ? "wait"
                        : "pointer",
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="gallery-photo"
                    />
                  </button>

                  {isUploading ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        background:
                          "rgba(0, 0, 0, 0.65)",
                        zIndex: 4,
                        pointerEvents: "none",
                      }}
                    >
                      <strong
                        style={{
                          color: "#fff",
                        }}
                      >
                        מעלה תמונה...
                      </strong>
                    </div>
                  ) : null}

                  <figcaption
                    contentEditable={!isUploading}
                    suppressContentEditableWarning
                    spellCheck={false}
                    title="לחץ כדי לערוך את הכיתוב"
                    onBlur={(event) =>
                      updateTitle(
                        item.id,
                        event.currentTarget.textContent ||
                          ""
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    style={{
                      cursor: "text",
                      outline: "none",
                    }}
                  >
                    {item.title}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          <p
            style={{
              marginTop: "18px",
              textAlign: "center",
              opacity: 0.75,
            }}
          >
            לחץ על תמונה כדי להחליף אותה, לחץ על
            הכיתוב כדי לערוך, וגרור תמונות כדי לשנות
            את הסדר.
          </p>
        </section>
      ) : null}

      {historyItem ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeHistory();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background: "rgba(0, 0, 0, 0.78)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-history-title"
            dir="rtl"
            style={{
              width: "min(920px, 100%)",
              maxHeight: "88vh",
              overflow: "auto",
              borderRadius: "18px",
              background: "#111",
              color: "#fff",
              boxShadow:
                "0 24px 80px rgba(0, 0, 0, 0.55)",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                padding: "20px",
                borderBottom:
                  "1px solid rgba(255, 255, 255, 0.12)",
                background: "#111",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 4px",
                    opacity: 0.65,
                  }}
                >
                  היסטוריית גרסאות
                </p>
                <h2
                  id="gallery-history-title"
                  style={{ margin: 0 }}
                >
                  {historyItem.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeHistory}
                disabled={Boolean(restoringVersionId)}
                aria-label="סגירת היסטוריית הגרסאות"
                style={{
                  width: "42px",
                  height: "42px",
                  border:
                    "1px solid rgba(255, 255, 255, 0.22)",
                  borderRadius: "50%",
                  background: "transparent",
                  color: "#fff",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {historyError ? (
                <div
                  className="panel info-box"
                  style={{ marginBottom: "16px" }}
                >
                  {historyError}
                </div>
              ) : null}

              {isHistoryLoading ? (
                <div className="panel">
                  טוען היסטוריית גרסאות...
                </div>
              ) : null}

              {!isHistoryLoading &&
              versions.length === 0 ? (
                <div className="panel">
                  עדיין אין גרסאות קודמות לתמונה הזאת.
                  לאחר שינוי ושמירה, המצב הקודם יופיע כאן.
                </div>
              ) : null}

              {!isHistoryLoading &&
              versions.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {versions.map((version) => {
                    const isRestoring =
                      restoringVersionId === version.id;

                    return (
                      <article
                        key={version.id}
                        style={{
                          overflow: "hidden",
                          border:
                            "1px solid rgba(255, 255, 255, 0.14)",
                          borderRadius: "14px",
                          background:
                            "rgba(255, 255, 255, 0.04)",
                        }}
                      >
                        <img
                          src={version.image_url}
                          alt={version.title}
                          style={{
                            display: "block",
                            width: "100%",
                            aspectRatio: "4 / 5",
                            objectFit: "cover",
                          }}
                        />

                        <div
                          style={{
                            display: "grid",
                            gap: "10px",
                            padding: "14px",
                          }}
                        >
                          <strong>{version.title}</strong>

                          <small
                            style={{ opacity: 0.68 }}
                          >
                            {formatVersionDate(
                              version.created_at
                            )}
                          </small>

                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              void restoreVersion(version)
                            }
                            disabled={Boolean(
                              restoringVersionId
                            )}
                          >
                            {isRestoring
                              ? "משחזר..."
                              : "שחזר גרסה"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}