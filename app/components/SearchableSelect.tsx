"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Check, Plus } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
};

type SearchableSelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  emptyMessage?: string;
  name?: string;
  id?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  required = false,
  allowClear = true,
  className = "",
  emptyMessage = "No matching options found",
  name,
  id,
  onAddNew,
  addNewLabel,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasTyped, setHasTyped] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 0, left: 0, width: 0, maxHeight: 250 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!hasTyped || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = (opt.label || "").toLowerCase().includes(q);
      const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(q) : false;
      const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false;
      const matchVal = (opt.value || "").toLowerCase().includes(q);
      return matchLabel || matchSub || matchBadge || matchVal;
    });
  }, [options, hasTyped, searchQuery]);

  // Dynamically calculate fixed viewport coordinates for portal rendering (always opens strictly downwards)
  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      setHasTyped(false);
      setSearchQuery("");
      return;
    }

    // Always position strictly BELOW the input field (never upward over the form fields)
    const availableHeight = Math.max(130, Math.min(250, window.innerHeight - rect.bottom - 12));

    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: availableHeight,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);

    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, updateCoords]);

  // Handle click outside (both container and portaled dropdown) to close and discard typed text
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inContainer = containerRef.current && containerRef.current.contains(target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!inContainer && !inDropdown) {
        setIsOpen(false);
        setHasTyped(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setHasTyped(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    setHasTyped(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setHasTyped(false);
        setSearchQuery("");
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHasTyped(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case "Tab":
        setIsOpen(false);
        setHasTyped(false);
        setSearchQuery("");
        break;
    }
  }

  const cleanAddNewLabel = useMemo(() => {
    if (!addNewLabel) return "Add New";
    return addNewLabel.replace(/^\+?\s*/, "").trim();
  }, [addNewLabel]);

  // Compute what should be displayed in the input field
  const displayInputValue = isOpen
    ? hasTyped
      ? searchQuery
      : selectedOption
      ? selectedOption.label
      : ""
    : selectedOption
    ? selectedOption.label
    : "";

  return (
    <div ref={containerRef} className={`relative w-full text-left ${className}`} id={id}>
      {/* Hidden native input for required form validation */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          value={value}
          onChange={() => {}}
          required={required}
          name={name}
        />
      )}

      {/* Main Combobox Input Field Container */}
      <div
        onClick={() => {
          if (!disabled) {
            if (!isOpen) setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 py-2 text-sm transition ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
            : "border-slate-200 text-slate-800 hover:border-slate-300 shadow-sm"
        }`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={displayInputValue}
            onChange={(e) => {
              setHasTyped(true);
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
                setHasTyped(false);
                setSearchQuery("");
                inputRef.current?.select();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 cursor-text font-medium"
          />
          {!hasTyped && selectedOption?.subLabel && (
            <span className="text-xs text-slate-400 font-normal shrink-0 hidden sm:inline truncate max-w-[120px]">
              ({selectedOption.subLabel})
            </span>
          )}
        </div>

        {/* Right Action Icons: Clear & Chevron */}
        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedOption && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (disabled) return;
              if (isOpen) {
                setIsOpen(false);
                setHasTyped(false);
                setSearchQuery("");
              } else {
                setIsOpen(true);
                setHasTyped(false);
                setSearchQuery("");
                inputRef.current?.focus();
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 transition"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Render popover into document.body using React Portal to break out of modal overflow clipping */}
      {mounted &&
        typeof document !== "undefined" &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 9999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Quick Add action inside dropdown */}
            {onAddNew && !disabled && (
              <div className="p-1 border-b border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                    setHasTyped(false);
                    setSearchQuery("");
                    onAddNew();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition active:scale-[0.99] text-left"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  </span>
                  <span className="truncate">{cleanAddNewLabel}</span>
                </button>
              </div>
            )}

            {/* Options List */}
            <ul
              ref={listRef}
              className="flex-1 overflow-y-auto p-1 text-sm focus:outline-none"
              role="listbox"
            >
              {filteredOptions.length === 0 ? (
                <li className="p-4 text-center text-xs text-slate-400 select-none">
                  <div>
                    {hasTyped && searchQuery.trim()
                      ? `No matching results for "${searchQuery}"`
                      : emptyMessage}
                  </div>
                </li>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(option.value);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : isHighlighted
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex-1 truncate">
                        <span className={isSelected ? "text-blue-700 font-bold" : "text-slate-800"}>
                          {option.label}
                        </span>
                        {option.subLabel && (
                          <span className="ml-1.5 text-[11px] text-slate-400 font-normal">
                            ({option.subLabel})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {option.badge && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {option.badge}
                          </span>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
