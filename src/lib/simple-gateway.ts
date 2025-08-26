// Simplified gateway that works without Redis - just for demo
export interface SimpleMachine {
  id: string;
  machineNumber: number;
  modelId: string;
  status: 'healthy' | 'offline';
  endpoint: string;
}

class SimpleGateway {
  private machines: SimpleMachine[] = [
    {
      id: 'machine-1',
      machineNumber: 1,
      modelId: 'openai/gpt-4o',
      status: 'healthy',
      endpoint: 'http://localhost:8001/v1/chat'
    },
    {
      id: 'machine-2', 
      machineNumber: 2,
      modelId: 'anthropic/claude-3.5-sonnet',
      status: 'healthy',
      endpoint: 'http://localhost:8002/v1/chat'
    },
    {
      id: 'machine-3',
      machineNumber: 3,
      modelId: 'google/gemini-1.5-pro', 
      status: 'healthy',
      endpoint: 'http://localhost:8003/v1/chat'
    },
    {
      id: 'machine-4',
      machineNumber: 4,
      modelId: 'meta/llama-3.1-70b',
      status: 'healthy',
      endpoint: 'http://localhost:8004/v1/chat'
    },
    {
      id: 'machine-5',
      machineNumber: 5,
      modelId: 'groq/gemma-groq-416',
      status: 'healthy', 
      endpoint: 'http://localhost:8005/v1/chat'
    }
  ];

  getMachines(): SimpleMachine[] {
    return this.machines;
  }

  toggleMachine(machineId: string): boolean {
    const machine = this.machines.find(m => m.id === machineId);
    if (!machine) return false;
    
    machine.status = machine.status === 'healthy' ? 'offline' : 'healthy';
    console.log(`Machine ${machine.machineNumber} toggled to: ${machine.status}`);
    return true;
  }

  getHealthyMachines(): SimpleMachine[] {
    return this.machines.filter(m => m.status === 'healthy');
  }

  processRequest(model: string): { success: boolean; machine?: SimpleMachine; error?: string } {
    const healthyMachines = this.getHealthyMachines();
    
    if (healthyMachines.length === 0) {
      return { success: false, error: 'No healthy machines available' };
    }

    // Find machine that handles this model, or use any healthy machine
    let selectedMachine = healthyMachines.find(m => m.modelId === model);
    if (!selectedMachine) {
      // Round-robin selection from healthy machines
      selectedMachine = healthyMachines[Math.floor(Math.random() * healthyMachines.length)];
    }

    return { success: true, machine: selectedMachine };
  }
}

// Singleton
let simpleGateway: SimpleGateway | null = null;

export function getSimpleGateway(): SimpleGateway {
  if (!simpleGateway) {
    simpleGateway = new SimpleGateway();
  }
  return simpleGateway;
}