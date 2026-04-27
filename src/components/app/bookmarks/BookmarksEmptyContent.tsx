import { useTranslation } from 'react-i18next';
import type { BookmarkType } from '@/hooks/use-bookmarks';
import bookmark3dIcon from '@/assets/icons/bookmark-3d-icon.png';

const tabConfig: Record<BookmarkType, { titleKey: string; descKey: string }> = {
  all:     { titleKey: 'bookmarks.noBookmarksYet',  descKey: 'bookmarks.startSaving' },
  liked:   { titleKey: 'bookmarks.noLikedYet',      descKey: 'bookmarks.likedStartSaving' },
  history: { titleKey: 'bookmarks.noHistoryYet',    descKey: 'bookmarks.historyStartSaving' },
  recent:  { titleKey: 'bookmarks.noRecentYet',     descKey: 'bookmarks.recentStartSaving' },
  ppv:     { titleKey: 'bookmarks.noPpvYet',        descKey: 'bookmarks.ppvStartSaving' },
  images:  { titleKey: 'bookmarks.noImagesYet',     descKey: 'bookmarks.imagesStartSaving' },
  videos:  { titleKey: 'bookmarks.noVideosYet',     descKey: 'bookmarks.videosStartSaving' },
  text:    { titleKey: 'bookmarks.noTextYet',       descKey: 'bookmarks.textStartSaving' },
};

interface Props {
  activeTab: BookmarkType;
  searchQuery: string;
}

export function BookmarksEmptyContent({ activeTab, searchQuery }: Props) {
  const { t } = useTranslation();
  const config = tabConfig[activeTab] ?? tabConfig.all;

  return (
    <div className="text-center">
      <img src={bookmark3dIcon} alt="" className="w-12 h-12 object-contain mx-auto mb-3 opacity-60" />
      <h2 className="text-xl font-bold text-white mb-3">
        {searchQuery ? t('bookmarks.noMatchingBookmarks') : t(config.titleKey)}
      </h2>
      <p className="text-zinc-500 max-w-sm mx-auto">
        {searchQuery ? t('bookmarks.noMatchSearch', { query: searchQuery }) : t(config.descKey)}
      </p>
    </div>
  );
}
