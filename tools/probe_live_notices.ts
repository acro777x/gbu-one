import { fetchLiveNotices } from '../src/features/notices/liveNotices';
import { toNoticeItems } from '../src/features/notices/liveNoticeMapping';

async function main() {
  const result = await fetchLiveNotices({ timeoutMs: 20000 });
  console.log('sources:', result.sources);
  console.log('errors:', result.errors);
  console.log('live notices:', result.notices.length);

  const items = toNoticeItems(result.notices);
  console.log('mapped:', items.length);
  for (const item of items.slice(0, 6)) {
    console.log(
      `  ${item.postedAt.slice(0, 10)} [${item.category}] imp=${item.importance} ${item.cleanTitle.slice(0, 70)}`,
    );
    if (item.fileUrl) console.log(`      -> ${item.fileUrl.slice(0, 100)}`);
  }

  const pdfs = items.filter((i) => i.fileType === 'pdf').length;
  const images = items.filter((i) => i.fileType === 'image').length;
  console.log(`pdf links: ${pdfs}, image links: ${images}`);
  const dated = items.filter((i) => !i.postedAt.startsWith(String(new Date().getUTCFullYear()))).length;
  console.log(`notices with a real publication date: ${dated}/${items.length}`);
}

void main();
