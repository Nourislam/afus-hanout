// IPC handlers: sync. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        SyncManager,
        ipcMain,
        runInsert,
    } = ctx;

    // ==========================================
    // Optional sync boundary: no transport is bundled, so nothing is sent
    // anywhere (see electron/sync/SyncManager.js). Kept for a future online module.
    // ==========================================
    ipcMain.handle('sync:trigger', async () => {
      if (SyncManager) {
        SyncManager.triggerSync();
        return true;
      }
      return false;
    });

    ipcMain.handle('sync:incoming', async (_, data) => {
      await SyncManager.handleIncoming(data);
    });

    ipcMain.handle('sync:ack', async (_, data) => {
      await SyncManager.handleAck(data);
    });

    // Batch ACK (optimized)
    ipcMain.handle('sync:batch-ack', async (_, data) => {
      await SyncManager.handleBatchAck(data);
    });

    // Batch incoming (optimized)
    ipcMain.handle('sync:incoming-batch', async (_, data) => {
      await SyncManager.handleIncomingBatch(data);
    });

    // Online/offline status
    ipcMain.handle('sync:set-online', async (_, isOnline) => {
      SyncManager.setOnlineStatus(isOnline);
      return true;
    });

    // Get sync status
    ipcMain.handle('sync:get-status', async () => {
      return SyncManager.getStatus();
    });

    ipcMain.handle('sync:set-token', async () => {
      // Nothing to authenticate against: no sync transport is bundled
      return true;
    });

    ipcMain.handle('sync:force-push', async () => {
      const tables = [
        'products', 'customers', 'sales', 'employees', 'inventory_logs',
        'gift_cards', 'bundles', 'promotions',
        'categories', 'suppliers', 'purchase_orders', 'receivings', 'supplier_invoices',
        'sale_items', 'purchase_order_items', 'receiving_items',
        'credit_sales', 'credit_payments',
        'quotations', 'quotation_items',
        'returns', 'return_items', 'supplier_payments'
      ];

      // Reset is_synced to 0 for all records to force a re-upload
      for (const table of tables) {
        try {
          runInsert(`UPDATE ${table} SET is_synced = 0`);
        } catch (e) {
          console.error(`Failed to reset sync status for ${table}`, e);
        }
      }

      SyncManager.forceSyncNow();
      return true;
    });
};
