import Medusa from "@medusajs/js-sdk";
import type { AdminSalesChannel, AdminProduct } from "@medusajs/types";
import { CloudflareEnv } from "./api-utils";
import { getPlatformSettings } from "./platform-settings-d1";

// Re-export for compatibility or ease of use
export type MedusaSalesChannel = AdminSalesChannel;

export async function createMedusaClient(env: CloudflareEnv): Promise<MedusaAdminClient> {
  let token = env.MEDUSA_ADMIN_API_TOKEN;
  let backendUrl = env.MEDUSA_BACKEND_URL;

  try {
    const platform = await getPlatformSettings(env.DB);
    if (platform.medusa?.adminApiToken) {
      token = platform.medusa.adminApiToken;
    }
    if (platform.medusa?.backendUrl) {
      backendUrl = platform.medusa.backendUrl;
    }
  } catch (e) {
    console.warn("Failed to fetch platform Medusa settings", e);
  }

  if (!backendUrl || !token) {
    throw new Error("Medusa configuration missing");
  }

  return new MedusaAdminClient(backendUrl, token);
}

export class MedusaAdminClient {
  public sdk: Medusa;
  
  // ... rest of class ...

  constructor(baseUrl: string, apiToken: string) {
    // Medusa JS SDK expects apiKey for sk_/pk_ (sends Basic base64(apiKey + ":")); JWT via auth flow or Bearer in globalHeaders
    const isApiKey = /^sk_|^pk_/.test(apiToken);
    this.sdk = new Medusa({
      baseUrl: baseUrl.replace(/\/$/, ''),
      debug: process.env.NODE_ENV === "development",
      ...(isApiKey ? { apiKey: apiToken } : { globalHeaders: { Authorization: `Bearer ${apiToken}` } }),
    } as any);
  }

  /**
   * Create a new sales channel
   */
  async createSalesChannel(name: string, description?: string): Promise<MedusaSalesChannel> {
    const { sales_channel } = await this.sdk.admin.salesChannel.create({
      name,
      description: description || `Created via CMS for site: ${name}`,
      is_disabled: false,
    });
    return sales_channel;
  }

  /**
   * Update a sales channel
   */
  async updateSalesChannel(id: string, updates: { name?: string; is_disabled?: boolean }): Promise<MedusaSalesChannel> {
    const { sales_channel } = await this.sdk.admin.salesChannel.update(id, updates);
    return sales_channel;
  }

  /**
   * Delete a sales channel
   */
  async deleteSalesChannel(id: string): Promise<void> {
    await this.sdk.admin.salesChannel.delete(id);
  }

  /**
   * Create a publishable API key (pk_...) and optionally link it to sales channels.
   * Returns the created api_key; token is only present in create response (save it once).
   */
  async createPublishableKey(title: string, salesChannelIds?: string[]): Promise<{ id: string; token?: string }> {
    const { api_key } = await this.sdk.admin.apiKey.create({
      title: title || 'Storefront',
      type: 'publishable',
    } as any);
    const id = (api_key as any).id;
    if (salesChannelIds?.length && id) {
      await this.sdk.admin.apiKey.batchSalesChannels(id, { add: salesChannelIds } as any);
    }
    return { id, token: (api_key as any).token };
  }

  // ─── Products ────────────────────────────────────────────────

  async listProducts(params: { limit?: number; offset?: number; q?: string; sales_channel_id?: string[] } = {}) {
    const { products, count, offset, limit } = await this.sdk.admin.product.list({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      sales_channel_id: params.sales_channel_id,
      // @ts-ignore - The SDK might handle expand differently or it's part of query params
      fields: '*variants,*options,*images,*variants.prices', // V2 uses fields/expand logic
    } as any);
    
    return { products, count, offset, limit };
  }

  async getProduct(id: string) {
    const { product } = await this.sdk.admin.product.retrieve(id, {
      fields: '*variants,*options,*images,*variants.prices',
    });
    return { product };
  }

  async createProduct(data: any) {
    const { product } = await this.sdk.admin.product.create(data);
    return { product };
  }

  async updateProduct(id: string, data: any) {
    const { product } = await this.sdk.admin.product.update(id, data);
    return { product };
  }

  async deleteProduct(id: string) {
    const result = await this.sdk.admin.product.delete(id);
    return result;
  }

  // ─── Orders ──────────────────────────────────────────────────

  async listOrders(params: { limit?: number; offset?: number; q?: string; status?: string[]; payment_status?: string[]; fulfillment_status?: string[]; sales_channel_id?: string[] } = {}) {
    const { orders, count, offset, limit } = await this.sdk.admin.order.list({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      status: params.status,
      payment_status: params.payment_status,
      fulfillment_status: params.fulfillment_status,
      sales_channel_id: params.sales_channel_id,
      fields: 'id,status,display_id,created_at,email,payment_status,fulfillment_status,total,*shipping_address',
    } as any);
    return { orders, count, offset, limit };
  }

  async getOrder(id: string) {
    const { order } = await this.sdk.admin.order.retrieve(id, {
      fields: '*items,*items.variant,*items.variant.product,*customer,*shipping_address,*billing_address,*fulfillments,*payments,*region,*currency,*events',
    });
    return { order };
  }

  async createFulfillment(orderId: string, items: { item_id: string; quantity: number }[], no_notification = false) {
    const { fulfillment } = await this.sdk.admin.order.createFulfillment(orderId, {
      items,
      no_notification,
    });
    return { fulfillment };
  }

  async createShipment(orderId: string, fulfillmentId: string, tracking_numbers: string[], no_notification = false) {
    const { shipment } = await this.sdk.admin.order.createShipment(orderId, {
      fulfillment_id: fulfillmentId,
      tracking_numbers,
      no_notification,
    });
    return { shipment };
  }

  async capturePayment(orderId: string) {
    const { order } = await this.sdk.admin.order.capturePayment(orderId);
    return { order };
  }

  // ─── Draft Orders ────────────────────────────────────────────

  async createDraftOrder(data: any) {
    const { draft_order } = await this.sdk.admin.draftOrder.create(data);
    return { draft_order };
  }

  // ─── Users ───────────────────────────────────────────────────

  async createUser(data: { email: string; first_name?: string; last_name?: string; password?: string; role?: string }) {
    // Use raw fetch since sdk.admin.user.create is not available in some SDK versions
    const result = await this.sdk.client.fetch('/admin/users', {
      method: 'POST',
      body: data,
    });
    return result as { user: any };
  }

  async resetPassword(password: string) {
    // Updates the password for the current authenticated user (the owner of the API Key)
    // Using "user" actor type and "emailpass" provider
    return await this.sdk.auth.updateProvider(
      "user",
      "emailpass",
      { password }
    );
  }

  // ─── Regions ──────────────────────────────────────────────────

  async listRegions(params: { limit?: number; offset?: number; q?: string } = {}) {
    const { regions, count, offset, limit } = await this.sdk.admin.region.list({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      fields: 'id,name,currency_code,*countries,automatic_taxes,payment_providers,created_at,updated_at',
    } as any);
    return { regions, count, offset, limit };
  }

  async getRegion(id: string) {
    const { region } = await this.sdk.admin.region.retrieve(id, {
      fields: 'id,name,currency_code,*countries,automatic_taxes,payment_providers,metadata,created_at,updated_at',
    });
    return { region };
  }

  async createRegion(data: { name: string; currency_code: string; countries?: string[]; payment_providers?: string[]; automatic_taxes?: boolean }) {
    const { region } = await this.sdk.admin.region.create(data);
    return { region };
  }

  async updateRegion(id: string, data: { name?: string; currency_code?: string; countries?: string[]; payment_providers?: string[]; automatic_taxes?: boolean }) {
    const { region } = await this.sdk.admin.region.update(id, data);
    return { region };
  }

  async deleteRegion(id: string) {
    const result = await this.sdk.admin.region.delete(id);
    return result;
  }

  // ─── Stock Locations ──────────────────────────────────────────

  async listStockLocations(params: { limit?: number; offset?: number; q?: string; sales_channel_id?: string[] } = {}) {
    const { stock_locations, count, offset, limit } = await this.sdk.admin.stockLocation.list({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      sales_channel_id: params.sales_channel_id,
      fields: 'id,name,address_id,*address,*sales_channels,*fulfillment_sets,*fulfillment_providers,created_at,updated_at',
    } as any);
    return { stock_locations, count, offset, limit };
  }

  async getStockLocation(id: string) {
    const { stock_location } = await this.sdk.admin.stockLocation.retrieve(id, {
      fields: 'id,name,address_id,*address,*sales_channels,*fulfillment_sets,*fulfillment_providers,metadata,created_at,updated_at',
    });
    return { stock_location };
  }

  async createStockLocation(data: { name: string; address?: { address_1?: string; country_code: string; city?: string; postal_code?: string; province?: string } }) {
    const { stock_location } = await this.sdk.admin.stockLocation.create(data);
    return { stock_location };
  }

  async updateStockLocation(id: string, data: { name?: string; address?: { address_1?: string; country_code?: string; city?: string; postal_code?: string; province?: string } }) {
    const { stock_location } = await this.sdk.admin.stockLocation.update(id, data);
    return { stock_location };
  }

  async deleteStockLocation(id: string) {
    const result = await this.sdk.admin.stockLocation.delete(id);
    return result;
  }

  async updateStockLocationSalesChannels(id: string, body: { add?: string[]; remove?: string[] }) {
    const { stock_location } = await this.sdk.admin.stockLocation.updateSalesChannels(id, body);
    return { stock_location };
  }

  // ─── Shipping Options ─────────────────────────────────────────

  async listShippingOptions(params: { limit?: number; offset?: number; q?: string; stock_location_id?: string[]; service_zone_id?: string[] } = {}) {
    const { shipping_options, count, offset, limit } = await this.sdk.admin.shippingOption.list({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      stock_location_id: params.stock_location_id,
      service_zone_id: params.service_zone_id,
      fields: 'id,name,price_type,service_zone_id,*service_zone,provider_id,*provider,shipping_profile_id,*shipping_profile,*prices,created_at,updated_at',
    } as any);
    return { shipping_options, count, offset, limit };
  }

  async getShippingOption(id: string) {
    const { shipping_option } = await this.sdk.admin.shippingOption.retrieve(id, {
      fields: 'id,name,price_type,service_zone_id,*service_zone,provider_id,*provider,shipping_profile_id,*shipping_profile,*prices,*rules,data,metadata,created_at,updated_at',
    });
    return { shipping_option };
  }

  async createShippingOption(data: any) {
    const { shipping_option } = await this.sdk.admin.shippingOption.create(data);
    return { shipping_option };
  }

  async updateShippingOption(id: string, data: any) {
    const { shipping_option } = await this.sdk.admin.shippingOption.update(id, data);
    return { shipping_option };
  }

  async deleteShippingOption(id: string) {
    const result = await this.sdk.admin.shippingOption.delete(id);
    return result;
  }

  // ─── Fulfillment Sets & Service Zones (for shipping option creation) ─────────────────

  async listFulfillmentSets(params: { stock_location_id?: string[] } = {}) {
    const { fulfillment_sets, count, offset, limit } = await this.sdk.admin.fulfillmentSet.list({
      stock_location_id: params.stock_location_id,
      fields: 'id,name,type,*service_zones,stock_location_id,created_at,updated_at',
    } as any);
    return { fulfillment_sets, count, offset, limit };
  }

  async createServiceZone(fulfillmentSetId: string, data: { name: string; geo_zones?: { type: string; country_code?: string }[] }) {
    const { fulfillment_set } = await this.sdk.admin.fulfillmentSet.createServiceZone(fulfillmentSetId, data);
    return { fulfillment_set };
  }

  // ─── Shipping Profiles (for shipping option creation) ──────────

  async listShippingProfiles() {
    const { shipping_profiles, count, offset, limit } = await this.sdk.admin.shippingProfile.list({
      limit: 100,
      fields: 'id,name,type,created_at,updated_at',
    } as any);
    return { shipping_profiles, count, offset, limit };
  }
}
