import {expect, openFromRail, openSampleProject, test} from './fixtures';

/*
 * The search model ships with the app (5.8 follow-up): indexing a project uses
 * the bundled model with every non-loopback request blocked and recorded, and
 * nothing tries to reach the network.
 */
test('indexes a project with the bundled search model and no network', async ({desktop}) => {
  const {app, page} = desktop;
  const remoteRequests: string[] = [];
  await app.context().route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => {
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });

  await openSampleProject(page);
  await openFromRail(page, 'Source Notes');
  await page.getByRole('button', {name: /Rebuild Context/}).first().click();

  // The real model makes 384-number vectors; the built-in fallback makes 32.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const sizes = new Set<number>();
          for (const info of await indexedDB.databases()) {
            if (!info.name?.startsWith('rag-')) continue;
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open(info.name!);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            const rows = await new Promise<Array<{embedding?: number[]}>>((resolve) => {
              const request = db.transaction('chunks').objectStore('chunks').getAll();
              request.onsuccess = () => resolve(request.result);
            });
            db.close();
            for (const row of rows) if (row.embedding) sizes.add(row.embedding.length);
          }
          return [...sizes];
        }),
      {timeout: 60_000, intervals: [1_000]}
    )
    .toEqual([384]);

  expect(remoteRequests).toEqual([]);
  expect(warnings.filter((text) => /bundled search model|Falling back/.test(text))).toEqual([]);
  expect(desktop.rendererErrors).toEqual([]);
});
