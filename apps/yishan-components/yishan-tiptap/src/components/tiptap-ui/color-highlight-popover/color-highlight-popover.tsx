import * as React from "react";
import { type Editor } from "@tiptap/react";

// --- Hooks ---
import { useMenuNavigation } from "@/hooks/use-menu-navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTiptapEditor } from "@/hooks/use-tiptap-editor";

// --- Icons ---
import { BanIcon } from "@/components/tiptap-icons/ban-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button";
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/tiptap-ui-primitive/popover";
import {
  Card,
  CardBody,
  CardItemGroup,
} from "@/components/tiptap-ui-primitive/card";

// --- Tiptap UI ---
import type {
  HighlightColor,
  UseColorHighlightConfig,
} from "@/components/tiptap-ui/color-highlight-button";
import {
  ColorHighlightButton,
  pickHighlightColorsByValue,
  useColorHighlight,
} from "@/components/tiptap-ui/color-highlight-button";
import {
  pickTextColorsByValue,
  TextColor,
  useColorText,
} from "../color-text-button/use-color-text";
import {
  ColorTextButton,
} from "../color-text-button/color-text-button";

export interface ColorHighlightPopoverContentProps {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null;
  textColors?: TextColor[];
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  bgColors?: HighlightColor[];
}

export interface ColorHighlightPopoverProps
  extends Omit<ButtonProps, "type">,
    Pick<
      UseColorHighlightConfig,
      "editor" | "hideWhenUnavailable" | "onApplied"
    > {
  textColors?: TextColor[];
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  bgColors?: HighlightColor[];
}

export const ColorHighlightPopoverButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ className, children, ...props }, ref) => (
  <Button
    type="button"
    className={className}
    data-style="ghost"
    data-appearance="default"
    role="button"
    tabIndex={-1}
    aria-label="Highlight text"
    tooltip="Highlight"
    ref={ref}
    {...props}
  >
    {children ?? <HighlighterIcon className="tiptap-button-icon" />}
  </Button>
));

ColorHighlightPopoverButton.displayName = "ColorHighlightPopoverButton";

export function ColorHighlightPopoverContent({
  editor,
  textColors = pickTextColorsByValue(),
  bgColors = pickHighlightColorsByValue(),
}: ColorHighlightPopoverContentProps) {
  const { handleRemoveHighlight } = useColorHighlight({ editor });
  const isMobile = useIsMobile();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const allTextItems = React.useMemo(() => textColors, [textColors]);

  // 创建包含透明按钮的完整颜色数组，透明按钮放在最开头
  const allBgItems = React.useMemo(
    () => [
      {
        label: "透明",
        value: "none",
        border: "transparent",
      },
      ...bgColors,
    ],
    [bgColors]
  );

  const { handleRemoveTextColor } = useColorText({ editor });
  
  const { selectedIndex: selectedTextIndex } = useMenuNavigation({
    containerRef,
    items: allTextItems,
    orientation: "both",
    onSelect: (item) => {
      if (!containerRef.current) return false;
      const colorElement = containerRef.current.querySelector(
        '[data-color="true"]'
      ) as HTMLElement;
      if (colorElement) colorElement.click();
      if (item.value === "none") handleRemoveTextColor();
    },
    autoSelectFirstItem: false,
  });

  const { selectedIndex: selectedBgIndex } = useMenuNavigation({
    containerRef,
    items: allBgItems,
    orientation: "both",
    onSelect: (item) => {
      if (!containerRef.current) return false;
      const highlightedElement = containerRef.current.querySelector(
        '[data-highlighted="true"]'
      ) as HTMLElement;
      if (highlightedElement) highlightedElement.click();
      if (item.value === "none") handleRemoveHighlight();
    },
    autoSelectFirstItem: false,
  });

  // 将颜色分为5个一组
  const textColorGroups = React.useMemo(() => {
    const groups = [];
    for (let i = 0; i < allTextItems.length; i += 5) {
      groups.push(allTextItems.slice(i, i + 5));
    }
    return groups;
  }, [allTextItems]);


  // 将颜色分成5个一组
  const bgColorGroups = React.useMemo(() => {
    const groups = [];
    for (let i = 0; i < allBgItems.length; i += 5) {
      groups.push(allBgItems.slice(i, i + 5));
    }
    return groups;
  }, [allBgItems]);

  return (
    <Card
      ref={containerRef}
      tabIndex={0}
      style={isMobile ? { boxShadow: "none", border: 0 } : {}}
    >
      <CardBody style={isMobile ? { padding: 0 } : {}}>
        <CardItemGroup orientation="vertical">
          <div className="tiptap-card-group-label">字体颜色</div>
          {textColorGroups.map((group, groupIndex) => (
            <ButtonGroup key={groupIndex} orientation="horizontal">
              {group.map((item, index) => {
                const globalIndex = groupIndex * 5 + index;

                // 颜色按钮
                return (
                  <ColorTextButton
                    key={item.value}
                    editor={editor}
                    textColor={item.value}
                    tooltip={item.label}
                    aria-label={`${item.label} text color`}
                    tabIndex={globalIndex === selectedTextIndex ? 0 : -1}
                    data-color={selectedTextIndex === globalIndex}
                  />
                );
              })}
            </ButtonGroup>
          ))}
        </CardItemGroup>

        <CardItemGroup orientation="vertical">
          <div className="tiptap-card-group-label">背景颜色</div>
          {bgColorGroups.map((group, groupIndex) => (
            <ButtonGroup key={groupIndex} orientation="horizontal">
              {group.map((item, index) => {
                const globalIndex = groupIndex * 5 + index;

                if (item.value === "none") {
                  // 透明按钮
                  return (
                    <Button
                      key="none"
                      onClick={handleRemoveHighlight}
                      aria-label="透明"
                      tooltip="透明"
                      tabIndex={globalIndex === selectedBgIndex ? 0 : -1}
                      type="button"
                      role="menuitem"
                      data-style="ghost"
                      data-highlighted={selectedBgIndex === globalIndex}
                    >
                      <BanIcon className="tiptap-button-icon" />
                    </Button>
                  );
                }

                // 颜色按钮
                return (
                  <ColorHighlightButton
                    key={item.value}
                    editor={editor}
                    highlightColor={item.value}
                    tooltip={item.label}
                    aria-label={`${item.label} highlight color`}
                    tabIndex={globalIndex === selectedBgIndex ? 0 : -1}
                    data-highlighted={selectedBgIndex === globalIndex}
                  />
                );
              })}
            </ButtonGroup>
          ))}
        </CardItemGroup>
      </CardBody>
    </Card>
  );
}

export function ColorHighlightPopover({
  editor: providedEditor,
  bgColors = pickHighlightColorsByValue(),
  hideWhenUnavailable = false,
  onApplied,
  ...props
}: ColorHighlightPopoverProps) {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = React.useState(false);
  const { isVisible, canColorHighlight, isActive, label, Icon } =
    useColorHighlight({
      editor,
      hideWhenUnavailable,
      onApplied,
    });

  if (!isVisible) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <ColorHighlightPopoverButton
          disabled={!canColorHighlight}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={!canColorHighlight}
          aria-pressed={isActive}
          aria-label={label}
          tooltip={label}
          {...props}
        >
          <Icon className="tiptap-button-icon" />
        </ColorHighlightPopoverButton>
      </PopoverTrigger>
      <PopoverContent aria-label="背景颜色">
        <ColorHighlightPopoverContent editor={editor} bgColors={bgColors} />
      </PopoverContent>
    </Popover>
  );
}

export default ColorHighlightPopover;
