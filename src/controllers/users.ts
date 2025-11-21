import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

interface CustomResponse extends Response {
  data(payload: any, message?: string, status?: number): void;
  success(message: string, status?: number): void;
  errorMessage(message: string, payload?: any, status?: number): void;
}

export const getUsers = async (req: Request, res: CustomResponse, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find();
    
    // Using custom response methods
    res.data(users, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: CustomResponse, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.errorMessage('User not found', {}, 404);
      return;
    }
    
    res.data(user, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: CustomResponse, next: NextFunction): Promise<void> => {
  try {
    const user = await User.create(req.body);
    
    res.data(user, 'User created successfully', 201);
  } catch (error: any) {
    if (error.code === 11000) {
      res.errorMessage('Email already exists', {}, 409);
      return;
    }
    next(error);
  }
};

export const updateUser = async (req: Request, res: CustomResponse, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      res.errorMessage('User not found', {}, 404);
      return;
    }
    
    res.data(user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: CustomResponse, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      res.errorMessage('User not found', {}, 404);
      return;
    }
    
    res.success('User deleted successfully');
  } catch (error) {
    next(error);
  }
};