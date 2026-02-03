import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Pack {
  id: string;
  label_id: string;
  status: string;
  group_id: string | null;
  merchant_id: string | null;
  previous_uses: number;
  created_at: string;
}

interface Group {
  id: string;
  group_id: string;
  label_count: number;
  merchant_id: string | null;
  status: string;
  created_at: string;
}

// Generate a unique pack ID
const generatePackId = (prefix: string = 'PK') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Generate a unique group ID
const generateGroupId = (prefix: string = 'GRP') => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}${month}-${random}`;
};

export const useLabels = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Fetch all packs
  const fetchPacks = useCallback(async (filters?: { status?: string; groupId?: string }) => {
    setIsLoading(true);
    try {
      let query = supabase.from('labels').select('*').order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.groupId) {
        query = query.eq('group_id', filters.groupId);
      }
      
      const { data, error } = await query.limit(1000);
      
      if (error) throw error;
      setPacks(data || []);
      return data || [];
    } catch (error: any) {
      toast.error('Failed to fetch packs', { description: error.message });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch all groups
  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('label_groups')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setGroups(data || []);
      return data || [];
    } catch (error: any) {
      toast.error('Failed to fetch groups', { description: error.message });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate new pack IDs (batch)
  const generatePacks = useCallback(async (count: number, merchantId?: string) => {
    setIsLoading(true);
    try {
      const newPacks = Array.from({ length: count }, () => ({
        label_id: generatePackId(),
        status: 'produced',
        merchant_id: merchantId || null,
        previous_uses: 0,
      }));

      const { data, error } = await supabase
        .from('labels')
        .insert(newPacks)
        .select();

      if (error) throw error;
      
      toast.success(`Generated ${count} pack IDs`);
      await fetchPacks();
      return data;
    } catch (error: any) {
      toast.error('Failed to generate packs', { description: error.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPacks]);

  // Create a group from pack IDs
  const createGroup = useCallback(async (packIds: string[]) => {
    setIsLoading(true);
    try {
      const groupId = generateGroupId();
      
      // First, create the group
      const { data: groupData, error: groupError } = await supabase
        .from('label_groups')
        .insert({
          group_id: groupId,
          label_count: packIds.length,
          status: 'pending',
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Then, link all packs to this group
      const { error: updateError } = await supabase
        .from('labels')
        .update({ 
          group_id: groupData.id,
          status: 'grouped'
        })
        .in('label_id', packIds);

      if (updateError) throw updateError;

      toast.success(`Created group ${groupId} with ${packIds.length} packs`);
      await Promise.all([fetchGroups(), fetchPacks()]);
      return groupData;
    } catch (error: any) {
      toast.error('Failed to create group', { description: error.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchGroups, fetchPacks]);

  // Update pack status
  const updatePackStatus = useCallback(async (packIds: string[], status: string, merchantId?: string) => {
    setIsLoading(true);
    try {
      const updateData: { status: string; merchant_id?: string | null } = { status };
      
      if (merchantId !== undefined) {
        updateData.merchant_id = merchantId;
      }

      const { error } = await supabase
        .from('labels')
        .update(updateData)
        .in('label_id', packIds);

      if (error) throw error;
      
      toast.success(`Updated ${packIds.length} pack(s) to ${status}`);
      await fetchPacks();
      return true;
    } catch (error: any) {
      toast.error('Failed to update pack status', { description: error.message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPacks]);

  // Update group status and assign retailer to all packs in group
  const assignGroupToRetailer = useCallback(async (groupId: string, merchantId: string) => {
    setIsLoading(true);
    try {
      // Get the group first
      const { data: groupData, error: groupFetchError } = await supabase
        .from('label_groups')
        .select('id')
        .eq('group_id', groupId)
        .single();

      if (groupFetchError) throw groupFetchError;

      // Update all packs in this group
      const { error: packsError } = await supabase
        .from('labels')
        .update({ 
          merchant_id: merchantId,
          status: 'shipped'
        })
        .eq('group_id', groupData.id);

      if (packsError) throw packsError;

      // Update group status
      const { error: groupError } = await supabase
        .from('label_groups')
        .update({ 
          merchant_id: merchantId,
          status: 'shipped'
        })
        .eq('id', groupData.id);

      if (groupError) throw groupError;

      toast.success(`Assigned group ${groupId} to retailer`);
      await Promise.all([fetchGroups(), fetchPacks()]);
      return true;
    } catch (error: any) {
      toast.error('Failed to assign group', { description: error.message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchGroups, fetchPacks]);

  // Handle pack return (inbound)
  const handlePackReturn = useCallback(async (packId: string) => {
    setIsLoading(true);
    try {
      // Get current pack to increment uses
      const { data: currentPack, error: fetchError } = await supabase
        .from('labels')
        .select('previous_uses')
        .eq('label_id', packId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('labels')
        .update({ 
          status: 'returned',
          merchant_id: null,
          previous_uses: (currentPack?.previous_uses || 0) + 1
        })
        .eq('label_id', packId);

      if (error) throw error;
      
      toast.success(`Pack ${packId} marked as returned`);
      await fetchPacks();
      return true;
    } catch (error: any) {
      toast.error('Failed to process return', { description: error.message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPacks]);

  // Validate pack IDs from CSV
  const validatePackIds = useCallback(async (packIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('labels')
        .select('label_id, status, group_id')
        .in('label_id', packIds);

      if (error) throw error;

      const foundIds = new Set(data?.map(p => p.label_id) || []);
      const alreadyGrouped = data?.filter(p => p.group_id !== null).map(p => p.label_id) || [];
      const notFound = packIds.filter(id => !foundIds.has(id));
      const valid = packIds.filter(id => foundIds.has(id) && !alreadyGrouped.includes(id));

      return {
        valid,
        notFound,
        alreadyGrouped,
        total: packIds.length
      };
    } catch (error: any) {
      toast.error('Failed to validate pack IDs', { description: error.message });
      return null;
    }
  }, []);

  return {
    isLoading,
    packs,
    groups,
    fetchPacks,
    fetchGroups,
    generatePacks,
    createGroup,
    updatePackStatus,
    assignGroupToRetailer,
    handlePackReturn,
    validatePackIds,
  };
};
